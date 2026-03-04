// api/proxy.js
// Vercel serverless proxy — forwards requests to Pulsara server-side (no CORS).
// vercel.json: { "rewrites": [{ "source": "/api/proxy/(.*)", "destination": "/api/proxy?slug=$1" }] }

export const config = {
  api: { bodyParser: false },
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

  // ── Parse slug ────────────────────────────────────────────────────────────
  const slugRaw = req.query.slug;
  if (!slugRaw) return res.status(400).json({ error: 'Missing slug' });

  const parts   = slugRaw.split('/');
  const env     = parts[0];
  const apiPath = '/' + parts.slice(1).join('/');
  const host    = HOSTS[env];
  if (!host) return res.status(400).json({ error: `Unknown env "${env}"` });

  const qs = new URLSearchParams(req.query);
  qs.delete('slug');
  const qsStr     = qs.toString();
  const targetUrl = `${host}${apiPath}${qsStr ? '?' + qsStr : ''}`;

  // ── Build headers — forward EVERYTHING except host ────────────────────────
  const fwdHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lower = k.toLowerCase();
    // Skip hop-by-hop and host headers
    if (['host','connection','transfer-encoding','te','trailer','upgrade'].includes(lower)) continue;
    fwdHeaders[lower] = v;
  }

  console.log(`[proxy] ${req.method} ${targetUrl}`);
  console.log(`[proxy] x-api-key present: ${!!fwdHeaders['x-api-key']}`);
  console.log(`[proxy] x-api-key preview: ${fwdHeaders['x-api-key']?.slice(0,12)}...`);

  // ── Read body ─────────────────────────────────────────────────────────────
  let body = undefined;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = await readBody(req);
    console.log(`[proxy] body length: ${body?.length ?? 0}`);
  }

  // ── Proxy ─────────────────────────────────────────────────────────────────
  let upstream;
  try {
    upstream = await fetch(targetUrl, { method: req.method, headers: fwdHeaders, body });
  } catch (err) {
    console.error('[proxy] fetch error:', err);
    return res.status(502).json({ error: `Upstream fetch failed: ${err.message}` });
  }

  console.log(`[proxy] Pulsara responded: ${upstream.status}`);

  const ct  = upstream.headers.get('content-type') || 'application/json';
  const buf = Buffer.from(await upstream.arrayBuffer());
  console.log(`[proxy] response body: ${buf.toString().slice(0, 300)}`);

  res.status(upstream.status).setHeader('Content-Type', ct);
  return res.send(buf);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end',  () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on('error', reject);
  });
}
