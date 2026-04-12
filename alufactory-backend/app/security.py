import base64
import hashlib
import json
import os
from flask import current_app, request
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


ENVELOPE_KEY = '_secure_payload'
ENCRYPTION_ALGORITHM = 'RSA-OAEP-256+A256GCM'


def _b64decode(data: str) -> bytes:
    return base64.b64decode(data.encode('utf-8'))


def _load_or_generate_private_key():
    pem = os.getenv('PAYLOAD_ENCRYPTION_PRIVATE_KEY_PEM', '').strip()
    if pem:
        return serialization.load_pem_private_key(pem.encode('utf-8'), password=None)

    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def init_payload_encryption(app):
    private_key = _load_or_generate_private_key()
    public_key = private_key.public_key()

    public_key_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode('utf-8')

    key_id = hashlib.sha256(public_key_pem.encode('utf-8')).hexdigest()[:16]

    app.extensions['payload_encryption'] = {
        'private_key': private_key,
        'public_key_pem': public_key_pem,
        'key_id': key_id,
        'algorithm': ENCRYPTION_ALGORITHM,
    }


def get_public_encryption_material() -> dict:
    encryption = current_app.extensions.get('payload_encryption')
    if not encryption:
        raise RuntimeError('Payload encryption is not initialized')
    return {
        'key_id': encryption['key_id'],
        'algorithm': encryption['algorithm'],
        'public_key': encryption['public_key_pem'],
    }


def _decrypt_envelope(envelope: dict) -> dict:
    encryption = current_app.extensions.get('payload_encryption')
    if not encryption:
        raise ValueError('Payload encryption is not initialized')

    if not isinstance(envelope, dict):
        raise ValueError('Invalid encrypted payload format')

    if envelope.get('alg') != ENCRYPTION_ALGORITHM:
        raise ValueError('Unsupported encrypted payload algorithm')

    required_fields = ['encrypted_key', 'iv', 'ciphertext']
    if not all(f in envelope for f in required_fields):
        raise ValueError('Encrypted payload missing required fields')

    private_key = encryption['private_key']
    encrypted_key = _b64decode(envelope['encrypted_key'])
    iv = _b64decode(envelope['iv'])
    ciphertext = _b64decode(envelope['ciphertext'])

    try:
        aes_key = private_key.decrypt(
            encrypted_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )

        plain_bytes = AESGCM(aes_key).decrypt(iv, ciphertext, None)
    except Exception as exc:
        raise ValueError('Unable to decrypt encrypted payload') from exc

    try:
        decoded = json.loads(plain_bytes.decode('utf-8'))
    except Exception as exc:
        raise ValueError('Encrypted payload is not valid JSON') from exc

    if not isinstance(decoded, dict):
        raise ValueError('Encrypted payload must decode to a JSON object')

    return decoded


def get_request_json_secure() -> dict:
    data = request.get_json(silent=True)
    if data is None:
        return {}

    if not isinstance(data, dict):
        raise ValueError('JSON body must be an object')

    envelope = data.get(ENVELOPE_KEY)
    if envelope is None:
        return data

    return _decrypt_envelope(envelope)
