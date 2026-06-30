module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token, endpoint } = req.query;
  if (!token || !endpoint) {
    return res.status(400).json({ error: 'token e endpoint obrigatorios' });
  }

  const decodedEndpoint = decodeURIComponent(endpoint);

  const rawQuery = req.url.split('?')[1] || '';
  const params = new URLSearchParams(rawQuery);
  params.delete('token');
  params.delete('endpoint');

  const asaasUrl = `https://api.asaas.com/v3/${decodedEndpoint}?${params.toString().replace(/%5B/gi, '[').replace(/%5D/gi, ']')}`;

  try {
    const response = await fetch(asaasUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'access_token': token
      }
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.status(response.status).json(data);
    } catch(e) {
      return res.status(500).json({ error: 'Parse error', asaasStatus: response.status, body: text.substring(0, 500) });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
