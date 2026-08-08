import process from 'node:process';

const baseUrl = process.env.LOCAL_API_URL || 'http://127.0.0.1:5001/api';
const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const phone = `1${unique.slice(-10).padStart(10, '0')}`;

const request = async (requestPath, options = {}) => {
  const response = await fetch(`${baseUrl}${requestPath}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : new Uint8Array(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${requestPath} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return { response, body };
};

const jsonOptions = (method, body, token) => ({
  method,
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: body === undefined ? undefined : JSON.stringify(body),
});

await request('/health');

const registration = await request('/auth/register', jsonOptions('POST', {
  username: `local-smoke-${unique}`,
  phone,
  password: 'local-smoke-password',
}));
const token = registration.body.access_token;
if (!token) throw new Error('Local registration did not return an access token.');

const orderResult = await request('/orders', jsonOptions('POST', {
  items: [{
    product_id: 'local-smoke-profile',
    product_name: 'Local smoke profile',
    product_type: 'profile',
    quantity: 1,
    unit_price: 1,
    total_price: 1,
    config: { length: 100 },
  }],
  recipient_name: 'Local Test',
  phone,
  province: '上海',
  address_detail: 'Local-only smoke test',
  subtotal: 1,
  shipping_fee: 0,
  total_amount: 1,
  shipping_method: 'local-test',
}, token));
const orderId = orderResult.body?.order?.id;
if (!orderId) throw new Error('Local order creation did not return an order id.');

const minimalPdf = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
).toString('base64');

await request(`/orders/${orderId}/pdf`, jsonOptions('POST', {
  pdf_base64: minimalPdf,
  pdf_filename: 'local-smoke.pdf',
  pdf_type: 'with_price',
}, token));

const downloaded = await request(`/orders/${orderId}/pdf`, {
  headers: { Authorization: `Bearer ${token}` },
});
const signature = Buffer.from(downloaded.body).subarray(0, 4).toString();
if (signature !== '%PDF') throw new Error(`Downloaded file is not a PDF (signature: ${signature}).`);

const localAiResponse = await fetch(`${baseUrl}/ai/import/maycad-pdf`, jsonOptions('POST', {
  filename: 'local-smoke.pdf',
  extractedText: 'MayCAD local isolated smoke test',
  viewImages: ['data:image/png;base64,iVBORw0KGgo='],
}, token));
if (localAiResponse.status !== 404) {
  throw new Error(`Disabled AI route check expected 404, received ${localAiResponse.status}.`);
}

console.log(`Local backend smoke test passed: register -> order -> upload/download PDF -> AI route disabled (${orderId}).`);
