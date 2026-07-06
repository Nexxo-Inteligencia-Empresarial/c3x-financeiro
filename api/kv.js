module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Nibo-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key obrigatório' });

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(503).json({ error: 'KV não configurado' });

  const headers = { 'Authorization': `Bearer ${kvToken}`, 'Content-Type': 'application/json' };

  try {
    if (req.method === 'GET') {
      const r    = await fetch(kvUrl, { method: 'POST', headers, body: JSON.stringify(['GET', key]) });
      const data = await r.json();
      const raw  = data.result;
      const value = (raw !== null && raw !== undefined)
        ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
        : null;
      return res.json({ value });
    }

    if (req.method === 'POST') {
      if (!req.headers['x-nibo-token']) return res.status(401).json({ error: 'token obrigatório' });
      const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const r    = await fetch(kvUrl, { method: 'POST', headers, body: JSON.stringify(['SET', key, payload]) });
      const data = await r.json();
      return res.json({ ok: data.result === 'OK' });
    }

    return res.status(405).json({ error: 'método não suportado' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
