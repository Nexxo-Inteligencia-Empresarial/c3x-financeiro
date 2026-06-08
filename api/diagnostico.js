module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  // Buscar créditos de 2026 e inspecionar campos de status
  const url = `https://api.nibo.com.br/empresas/v1/schedules/credit?apitoken=${token}&$orderby=dueDate&$top=10&$filter=year(dueDate) eq 2026`;
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await r.json();

  // Mostrar campos relevantes dos primeiros itens
  const amostra = (data.items||[]).slice(0,5).map(i => ({
    dueDate: i.dueDate,
    value: i.value,
    isPaid: i.isPaid,
    isDue: i.isDue,
    isOverdue: i.isOverdue,
    situation: i.situation,
    status: i.status,
    paymentDate: i.paymentDate,
    openValue: i.openValue,
    paidValue: i.paidValue,
    costCenters: (i.costCenters||[]).map(c=>c.costCenterDescription||c.description),
    description: (i.description||'').substring(0,40),
  }));

  // Contar por situação
  const situacoes = {};
  for (const item of (data.items||[])) {
    const s = item.isPaid !== undefined ? (item.isPaid ? 'pago' : 'aberto') : 
              item.situation || item.status || 'desconhecido';
    situacoes[s] = (situacoes[s]||0) + 1;
  }

  return res.status(200).json({ total: data.items?.length, situacoes, amostra });
};
