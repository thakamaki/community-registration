// api/proxy.js
// Vercel serverless function — forwards requests to Pulsara server-side (no CORS).
// URL pattern:  /api/proxy/<env>/<pulsara-path>
// Example:      /api/proxy/demo/api/v2/patients

const HOSTS = {
  demo:       'https://us-internal-demo.pulsara.com',
  flex1:      'https://us-internal-flex1.pulsara.com',
  production: 'https://us-internal.pulsara.com',
};

export default async function handler(req, res) {
  // CORS headers so the browser doesn't block the response
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // slug arrives as a single string e.g. "demo/api/v2/patients"
  const slugRaw = req.query.slug;
  if (!slugRaw) {
    return res.status(400).json({ error: 'Usage: /api/proxy/<env>/<pulsara-path>' });
  }

  const parts    = slugRaw.split('/');          // ["demo","api","v2","patients"]
  const env      = parts[0];                    // "demo"
  const apiPath  = '/' + parts.slice(1).join('/'); // "/api/v2/patients"

  const host = HOSTS[env];
  if (!host) {
    return res.status(400).json({ error: `Unknown env "${env}". Use: ${Object.keys(HOSTS).join(', ')}` });
  }

  // Rebuild query string, dropping our internal slug param
  const qs = new URLSearchParams(req.query);
  qs.delete('slug');
  const qsStr    = qs.toString();
  const targetUrl = `${host}${apiPath}${qsStr ? '?' + qsStr : ''}`;

  // Forward only the headers Pulsara needs
  const fwdHeaders = {};
  if (req.headers['authorization']) fwdHeaders['authorization'] = req.headers['authorization'];
  if (req.headers['content-type'])  fwdHeaders['content-type']  = req.headers['content-type'];

  // Read body for mutating methods
  let body;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = await getRawBody(req);
  }

  const upstream = await fetch(targetUrl, {
    method:  req.method,
    headers: fwdHeaders,
    body:    body || undefined,
  });

  const contentType = upstream.headers.get('content-type') || 'application/json';
  res.status(upstream.status).setHeader('Content-Type', contentType);

  if (contentType.includes('application/json')) {
    return res.json(await upstream.json());
  } else {
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  }
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
