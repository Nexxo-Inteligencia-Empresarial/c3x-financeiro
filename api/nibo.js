module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token, endpoint } = req.query;
  if (!token || !endpoint) {
    return res.status(400).json({ error: 'token e endpoint obrigatorios' });
  }

  const rawQuery = req.url.split('?')[1] || '';
  const params = new URLSearchParams(rawQuery);
  params.delete('token');
  params.delete('endpoint');
  params.set('apitoken', token);

  const niboUrl = `https://api.nibo.com.br/empresas/v1/${endpoint}?${params.toString()}`;

  try {
    const response = await fetch(niboUrl, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.status(response.status).json(data);
    } catch(e) {
      return res.status(500).json({ error: 'Parse error', body: text.substring(0, 300), niboStatus: response.status });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
