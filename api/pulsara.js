// api/pulsara.js
export default async function handler(req, res) {
  // Remove the /api/pulsara prefix to get the real Pulsara endpoint path
  const path = req.url.replace(/^\/api\/pulsara/, '') || '/';
  const target = `https://us-internal-demo.pulsara.com${path}`;

  // Copy headers but remove ones that would expose the proxy
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const k = key.toLowerCase();
    if (['host', 'origin', 'referer', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'].includes(k)) {
      continue;
    }
    headers[key] = value;
  }

  // Spoof Origin to a domain Pulsara whitelists (from their web app)
  headers['origin'] = 'https://app-demo.pulsara.com';
  headers['referer'] = 'https://app-demo.pulsara.com/';

  // Read body for POST/PUT/PATCH (needed for OAuth login, patient create, attachments)
  let body = undefined;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = await new Promise((resolve) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: body || undefined,
    });

    // Forward all response headers except CORS-related ones (Vercel handles those)
    response.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (['access-control-allow-origin', 'access-control-allow-credentials'].includes(k)) return;
      res.setHeader(key, value);
    });

    // Allow browser to read the response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    res.status(response.status);

    // Forward the body (binary safe)
    const responseBody = await response.arrayBuffer();
    res.send(Buffer.from(responseBody));

  } catch (err) {
    console.error('[Pulsara Proxy Error]', err);
    res.status(502).json({ error: 'Proxy error', detail: err.message });
  }
}

// Disable bodyParser so we can handle raw body for multipart/form-data (attachments)
export const config = {
  api: {
    bodyParser: false,
  },
};
