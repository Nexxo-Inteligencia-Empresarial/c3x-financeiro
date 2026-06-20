module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token, endpoint, base } = req.query;
  if (!token || !endpoint) {
    return res.status(400).json({ error: 'token e endpoint obrigatorios' });
  }

  const decodedEndpoint = decodeURIComponent(endpoint);

  const rawQuery = req.url.split('?')[1] || '';
  const params = new URLSearchParams(rawQuery);
  params.delete('token');
  params.delete('endpoint');
  params.delete('base');

  let niboUrl;
  if (base === 'empresa') {
    // API interna do Nibo web app: api-empresa.nibo.com.br
    params.set('apitoken', token);
    niboUrl = `https://api-empresa.nibo.com.br/${decodedEndpoint}?${params.toString()}`;
  } else {
    // API pública padrão
    params.set('apitoken', token);
    niboUrl = `https://api.nibo.com.br/empresas/v1/${decodedEndpoint}?${params.toString()}`;
  }

  try {
    const response = await fetch(niboUrl, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.status(response.status).json(data);
    } catch(e) {
      return res.status(500).json({ error: 'Parse error', niboStatus: response.status, body: text.substring(0, 500) });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
