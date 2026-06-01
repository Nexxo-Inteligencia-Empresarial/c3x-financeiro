const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token, endpoint } = req.query;

  if (!token || !endpoint) {
    return res.status(400).json({ error: 'token e endpoint obrigatorios' });
  }

  // Pega a query string original e substitui apenas o token e endpoint
  // Preserva todos os outros params como vieram ($filter, $top, $orderby, etc)
  const rawQuery = req.url.split('?')[1] || '';
  const params = new URLSearchParams(rawQuery);
  params.delete('token');
  params.delete('endpoint');
  params.set('apitoken', token);

  const niboPath = `/empresas/v1/${endpoint}?${params.toString()}`;

  console.log('Chamando Nibo:', niboPath.substring(0, 150));

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.nibo.com.br',
      port: 443,
      path: niboPath,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'C3X-Dashboard/1.0'
      }
    };

    const request = https.request(options, (response) => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        console.log('Nibo status:', response.statusCode, 'body length:', body.length);
        try {
          const json = JSON.parse(body);
          res.status(response.statusCode).json(json);
        } catch (e) {
          res.status(500).json({
            error: 'Parse error',
            niboStatus: response.statusCode,
            body: body.substring(0, 300)
          });
        }
        resolve();
      });
    });

    request.on('error', (e) => {
      console.error('Request error:', e.message);
      res.status(500).json({ error: e.message, code: e.code });
      resolve();
    });

    request.setTimeout(15000, () => {
      request.destroy();
      res.status(504).json({ error: 'Timeout' });
      resolve();
    });

    request.end();
  });
};
