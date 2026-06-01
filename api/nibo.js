export default async function handler(req, res) {
  // CORS — permite chamadas do próprio domínio Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { token, endpoint } = req.query;

  if (!token || !endpoint) {
    return res.status(400).json({ error: 'token e endpoint são obrigatórios' });
  }

  // Monta a URL da API do Nibo
  // endpoint vem como ex: "accounts", "schedules/credit", etc.
  // query extras são repassadas
  const { token: _t, endpoint: _e, ...rest } = req.query;
  const params = new URLSearchParams({ apitoken: token, ...rest });
  const niboUrl = `https://api.nibo.com.br/empresas/v1/${endpoint}?${params.toString()}`;

  try {
    const response = await fetch(niboUrl, {
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao conectar com o Nibo', detail: err.message });
  }
}
