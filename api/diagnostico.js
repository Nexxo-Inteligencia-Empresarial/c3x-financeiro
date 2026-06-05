module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  // Tentar endpoints de indicadores/KPIs do Nibo
  const endpoints = [
    'indicators',
    'dashboardindicators', 
    'kpis',
    'scorecards',
    'goals',
    'targets',
    'performance',
    'reports/indicators',
  ];

  const results = {};
  for (const ep of endpoints) {
    try {
      const url = `https://api.nibo.com.br/empresas/v1/${ep}?apitoken=${token}&$top=5`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const text = await r.text();
      results[ep] = { status: r.status, body: text.substring(0, 200) };
    } catch(e) {
      results[ep] = { error: e.message };
    }
  }

  // Também testar endpoint de centros de custo
  try {
    const url = `https://api.nibo.com.br/empresas/v1/costcenters?apitoken=${token}&$top=20`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await r.json();
    results['costcenters'] = { status: r.status, items: (data.items||[]).map(i=>({id:i.id,name:i.name,isActive:i.isActive})) };
  } catch(e) {
    results['costcenters'] = { error: e.message };
  }

  return res.status(200).json(results);
};
