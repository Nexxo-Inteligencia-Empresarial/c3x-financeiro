import fetch from 'node-fetch';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token, endpoint } = req.query;
  if (!token || !endpoint) return res.status(400).json({ error: 'token e endpoint obrigatorios' });

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
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
