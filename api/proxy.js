// api/proxy.js
// Vercel serverless function — forwards requests to Pulsara, adding CORS headers.
// URL pattern:  /api/proxy/<env>/<pulsara-path>
// Example:      /api/proxy/demo/api/v2/patients
//
// Supported envs:  demo | flex1 | production

const HOSTS = {
  demo:       'https://us-internal-demo.pulsara.com',
  flex1:      'https://us-internal-flex1.pulsara.com',
  production: 'https://us-internal.pulsara.com',
};

export default async function handler(req, res) {
  // CORS — allow the Vercel app origin (and localhost for dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Parse  /api/proxy/<env>/<...rest>
  const slug = req.query.slug; // array from catch-all route
  if (!slug || slug.length < 2) {
    return res.status(400).json({ error: 'Usage: /api/proxy/<env>/<pulsara-path>' });
  }

  const [env, ...pathParts] = slug;
  const host = HOSTS[env];
  if (!host) {
    return res.status(400).json({ error: `Unknown env "${env}". Use: ${Object.keys(HOSTS).join(', ')}` });
  }

  const targetPath = '/' + pathParts.join('/');
  const qs = new URLSearchParams(req.query);
  // Remove the slug param itself
  qs.delete('slug');
  const qsStr = qs.toString();
  const targetUrl = `${host}${targetPath}${qsStr ? '?' + qsStr : ''}`;

  // Forward headers — pass Authorization through, drop host
  const fwdHeaders = {};
  if (req.headers['authorization']) fwdHeaders['authorization'] = req.headers['authorization'];
  if (req.headers['content-type'])  fwdHeaders['content-type']  = req.headers['content-type'];

  // Read body for POST/PUT etc.
  let body;
  if (['POST','PUT','PATCH'].includes(req.method)) {
    // Vercel provides the raw body buffer
    body = await getRawBody(req);
  }

  const upstream = await fetch(targetUrl, {
    method:  req.method,
    headers: fwdHeaders,
    body:    body || undefined,
  });

  const contentType = upstream.headers.get('content-type') || '';
  res.status(upstream.status);
  res.setHeader('Content-Type', contentType);

  if (contentType.includes('application/json')) {
    const json = await upstream.json();
    return res.json(json);
  } else {
    const buf = await upstream.arrayBuffer();
    return res.send(Buffer.from(buf));
  }
}

// Read the raw request body as a Buffer
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
