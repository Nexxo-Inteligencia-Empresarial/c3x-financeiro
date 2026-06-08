module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  const results = {};

  // Testar budgets 2026
  try {
    const url = `https://api.nibo.com.br/empresas/v1/budgets/2026?apitoken=${token}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const text = await r.text();
    results.budgets_2026 = { status: r.status, body: text.substring(0, 1000) };
  } catch(e) { results.budgets_2026 = { error: e.message }; }

  // Testar variações do endpoint
  const extras = ['budgets', 'budget/2026', 'budgets?year=2026', 'budgets/2026/categories'];
  for (const ep of extras) {
    try {
      const url = `https://api.nibo.com.br/empresas/v1/${ep}?apitoken=${token}`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const text = await r.text();
      results[ep] = { status: r.status, body: text.substring(0, 300) };
    } catch(e) { results[ep] = { error: e.message }; }
  }

  return res.status(200).json(results);
};
