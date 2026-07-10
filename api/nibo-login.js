async function kvSet(key, value, kvUrl, kvToken) {
  const r = await fetch(kvUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, JSON.stringify(value)])
  });
  const { result } = await r.json();
  return result === 'OK';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email e senha obrigatórios' });

  const kvUrl   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN  || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) return res.status(503).json({ error: 'KV não configurado' });

  try {
    const r = await fetch('https://auth.nibo.com.br/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        username: email,
        password,
        client_id: 'empresa-web',
        scope: 'openid empresa-api offline_access'
      }).toString()
    });

    const data = await r.json();

    if (!r.ok || !data.access_token) {
      const msg = data.error_description || data.error || JSON.stringify(data).slice(0, 200);
      return res.status(r.ok ? 500 : r.status).json({ error: msg });
    }

    const saved = await kvSet('nibo_auth', {
      token: data.access_token,
      refreshToken: data.refresh_token || null,
      savedAt: new Date().toISOString()
    }, kvUrl, kvToken);

    return res.json({ ok: saved, expiresIn: data.expires_in });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
