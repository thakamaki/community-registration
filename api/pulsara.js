export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/pulsara/, '') || '/';
  const target = `https://us-internal-demo.pulsara.com${path}`;

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const k = key.toLowerCase();
    if (['host', 'origin', 'referer', 'x-forwarded-for',
         'x-forwarded-host', 'x-forwarded-proto'].includes(k)) continue;
    headers[key] = value;
  }
  headers['origin']  = 'https://app-demo.pulsara.com';
  headers['referer'] = 'https://app-demo.pulsara.com/';

  let body;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = await new Promise(resolve => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end',  () => resolve(Buffer.concat(chunks)));
    });
  }

  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: body || undefined,
    });

    response.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (['access-control-allow-origin',
           'access-control-allow-credentials'].includes(k)) return;
      res.setHeader(key, value);
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'X-Error-Code, Content-Disposition');
    res.status(response.status);
    res.send(Buffer.from(await response.arrayBuffer()));

  } catch (err) {
    console.error('[Pulsara Proxy Error]', err);
    res.status(502).json({ error: 'Proxy error', detail: err.message });
  }
}

export const config = { api: { bodyParser: false } };
