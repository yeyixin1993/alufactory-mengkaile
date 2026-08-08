import json
import os
import re
import urllib.error
import urllib.request

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required


ai_import_bp = Blueprint('ai_import', __name__, url_prefix='/api/ai/import')


MAYCAD_SYSTEM_PROMPT = """You convert MayCAD assembly documents into editable Mengkaile aluminum-profile scenes.
Return JSON only. Never invent boards, tapping, colors, or accessories that are not visible in the PDF.
Use the BOM for exact profile model/length/count and the orthographic/isometric images for assembly transforms.

Mengkaile coordinate rules:
- millimeters; X=left/right, Y=up, Z=front/back.
- every profile is a separate item with quantity 1.
- profile local length axis is +X; rotationDeg is XYZ Euler angles and every angle is a multiple of 90.
- center positions are used, not endpoints.
- place the assembly near the origin with its lowest solid edge near Y=0.

Known MayCAD -> Mengkaile mappings:
- 20x20 2H corner / 22SP -> 2020-N2
- 20x20 1 closed face / 21SP -> 2020-N1
- ordinary 20x20 4H -> 2020
- ordinary PROF20-2040 / 20x40 -> 2040
- do not map ordinary 2040 to 2040-N1-40; that is a separate Mengkaile model the customer may select manually after import

Schema:
{"sourceTitle":"string","confidence":0.0,"warnings":["string"],"items":[{"kind":"profile","variantId":"2020","lengthMm":400,"positionMm":[0,200,0],"rotationDeg":[0,0,90],"colorId":"natural","holes":[],"tappingLeft":false,"tappingRight":false,"remark":"MayCAD PDF reconstruction; review"}]}

Machining may be included only when the face and distance are unambiguous. MayCAD blind bores are not Mengkaile tapping.
Add a warning for every uncertain profile mapping, face orientation, hidden member, or dimension.
"""


def _json_from_model_content(content):
    if isinstance(content, list):
        content = ''.join(str(part.get('text', '')) if isinstance(part, dict) else str(part) for part in content)
    raw = str(content or '').strip()
    raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.IGNORECASE)
    raw = re.sub(r'\s*```$', '', raw)
    return json.loads(raw)


@ai_import_bp.route('/maycad-pdf', methods=['POST'])
@jwt_required()
def import_maycad_pdf():
    data = request.get_json(silent=True) or {}
    extracted_text = str(data.get('extractedText') or '')[:60000]
    images = data.get('viewImages') or []
    if not extracted_text or not isinstance(images, list) or not images:
        return jsonify({'error': 'MayCAD PDF text and at least one rendered view are required'}), 400
    if len(images) > 3 or any(not isinstance(image, str) or not image.startswith('data:image/') for image in images):
        return jsonify({'error': 'Invalid MayCAD PDF view images'}), 400

    api_key = str(os.getenv('DASHSCOPE_API_KEY') or '').strip()
    if not api_key:
        return jsonify({'error': 'Qwen PDF import is not configured (DASHSCOPE_API_KEY is missing)'}), 503

    base_url = str(os.getenv('QWEN_API_BASE_URL') or 'https://dashscope.aliyuncs.com/compatible-mode/v1').rstrip('/')
    model = str(os.getenv('QWEN_VISION_MODEL') or 'qwen3.7-plus').strip()
    user_content = [
        {'type': 'text', 'text': f"Filename: {str(data.get('filename') or 'maycad.pdf')}\n\nExtracted MayCAD PDF text:\n{extracted_text}"},
        *[{'type': 'image_url', 'image_url': {'url': image}} for image in images],
    ]
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': MAYCAD_SYSTEM_PROMPT},
            {'role': 'user', 'content': user_content},
        ],
        'response_format': {'type': 'json_object'},
        'temperature': 0.1,
        'max_tokens': 12000,
    }
    upstream = urllib.request.Request(
        f'{base_url}/chat/completions',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(upstream, timeout=180) as response:
            result = json.loads(response.read().decode('utf-8'))
        content = result.get('choices', [{}])[0].get('message', {}).get('content')
        parsed = _json_from_model_content(content)
        if not isinstance(parsed.get('items'), list) or not parsed['items']:
            raise ValueError('Qwen returned no scene items')
        parsed['provider'] = 'qwen'
        parsed['model'] = model
        return jsonify(parsed), 200
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', errors='replace')[:1000]
        return jsonify({'error': f'Qwen request failed ({error.code}): {detail}'}), 502
    except (urllib.error.URLError, TimeoutError) as error:
        return jsonify({'error': f'Qwen request unavailable: {error}'}), 502
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        return jsonify({'error': f'Unable to parse Qwen MayCAD result: {error}'}), 502
