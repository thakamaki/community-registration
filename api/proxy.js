// api/proxy.js
// Vercel serverless proxy — forwards requests to Pulsara server-side (no CORS).
// Route pattern: /api/proxy/<env>/<pulsara-path>
// vercel.json rewrites /api/proxy/(.*) → /api/proxy?slug=$1

export const config = {
  api: {
    bodyParser: false, // we handle body manually to support multipart
  },
};

const HOSTS = {
  demo:       'https://us-internal-demo.pulsara.com',
  flex1:      'https://us-internal-flex1.pulsara.com',
  production: 'https://us-internal.pulsara.com',
};

export default async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-api-key,Authorization,Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Parse slug → env + path ───────────────────────────────────────────────
  const slugRaw = req.query.slug;
  if (!slugRaw) {
    return res.status(400).json({ error: 'Usage: /api/proxy/<env>/<pulsara-path>' });
  }

  const parts   = slugRaw.split('/');
  const env     = parts[0];
  const apiPath = '/' + parts.slice(1).join('/');
  const host    = HOSTS[env];

  if (!host) {
    return res.status(400).json({
      error: `Unknown env "${env}". Valid options: ${Object.keys(HOSTS).join(', ')}`
    });
  }

  // Strip internal query params, forward the rest
  const qs = new URLSearchParams(req.query);
  qs.delete('slug');
  const qsStr    = qs.toString();
  const targetUrl = `${host}${apiPath}${qsStr ? '?' + qsStr : ''}`;

  // ── Forward headers ────────────────────────────────────────────────────────
  const fwdHeaders = {};
  if (req.headers['x-api-key'])     fwdHeaders['x-api-key']     = req.headers['x-api-key'];
  if (req.headers['authorization']) fwdHeaders['authorization'] = req.headers['authorization'];
  // Forward content-type only for non-multipart (multipart needs browser-set boundary)
  const ct = req.headers['content-type'] || '';
  if (ct && !ct.startsWith('multipart/')) fwdHeaders['content-type'] = ct;

  // ── Read body ─────────────────────────────────────────────────────────────
  let body = undefined;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = await readBody(req);
    // For multipart, pass through the full content-type with boundary
    if (ct.startsWith('multipart/')) fwdHeaders['content-type'] = ct;
  }

  // ── Proxy to Pulsara ──────────────────────────────────────────────────────
  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method:  req.method,
      headers: fwdHeaders,
      body,
    });
  } catch (err) {
    console.error('Proxy fetch error:', err);
    return res.status(502).json({ error: `Upstream fetch failed: ${err.message}` });
  }

  // ── Stream response back ──────────────────────────────────────────────────
  const resCt = upstream.headers.get('content-type') || 'application/json';
  res.status(upstream.status).setHeader('Content-Type', resCt);

  const buf = Buffer.from(await upstream.arrayBuffer());
  return res.send(buf);
}

// Read the raw request body as a Buffer
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end',  () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on('error', reject);
  });
}
