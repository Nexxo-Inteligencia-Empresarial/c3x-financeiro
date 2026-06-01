const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token, endpoint, ...rest } = req.query;
  if (!token || !endpoint) {
    return res.status(400).json({ error: 'token e endpoint obrigatorios' });
  }

  const params = new URLSearchParams({ apitoken: token, ...rest });
  const path = `/empresas/v1/${endpoint}?${params.toString()}`;

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.nibo.com.br',
      path: path,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          res.status(response.statusCode).json(parsed);
        } catch (e) {
          res.status(500).json({ error: 'Resposta invalida do Nibo', raw: data.substring(0, 200) });
        }
        resolve();
      });
    });

    request.on('error', (err) => {
      res.status(500).json({ error: 'Erro de conexao', detail: err.message });
      resolve();
    });

    request.end();
  });
};
