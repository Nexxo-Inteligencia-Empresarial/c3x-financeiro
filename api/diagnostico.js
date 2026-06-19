module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  const results = {};

  // 1. Receitas de Junho 2026 (schedules/credit)
  const recUrl = `https://api.nibo.com.br/empresas/v1/schedules/credit?apitoken=${token}&$orderby=dueDate&$top=500&$filter=year(dueDate) eq 2026 AND month(dueDate) eq 6`;
  const recR = await fetch(recUrl, { headers: { 'Accept': 'application/json' } });
  const recData = await recR.json();

  let totalRecPago = 0, totalRecAberto = 0, totalRecTodos = 0;
  const recPorCC = {};
  for (const item of (recData.items || [])) {
    const v = Math.abs(item.value || 0);
    const openV = Math.abs(item.openValue || 0);
    const paidV = v - openV;
    totalRecTodos += v;
    if (item.isPaid) totalRecPago += v;
    else totalRecAberto += v;

    const ccs = item.costCenters || [];
    const ccNome = ccs.length > 0 ? (ccs[0].costCenterDescription || ccs[0].description || 'SEM_CC') : 'SEM_CC';
    if (!recPorCC[ccNome]) recPorCC[ccNome] = { total: 0, pago: 0, aberto: 0, qtd: 0 };
    recPorCC[ccNome].total += v;
    recPorCC[ccNome].qtd += 1;
    if (item.isPaid) recPorCC[ccNome].pago += v;
    else recPorCC[ccNome].aberto += v;
  }

  results.receitas_junho = {
    totalItens: recData.items?.length,
    totalGeral: Math.round(totalRecTodos * 100) / 100,
    totalPago: Math.round(totalRecPago * 100) / 100,
    totalAberto: Math.round(totalRecAberto * 100) / 100,
    porCentroCusto: recPorCC,
  };

  // 2. Despesas de Junho 2026 (schedules/debit)
  const despUrl = `https://api.nibo.com.br/empresas/v1/schedules/debit?apitoken=${token}&$orderby=dueDate&$top=500&$filter=year(dueDate) eq 2026 AND month(dueDate) eq 6`;
  const despR = await fetch(despUrl, { headers: { 'Accept': 'application/json' } });
  const despData = await despR.json();

  let totalDesp = 0, totalDespPago = 0;
  const despPorCat = {};
  for (const item of (despData.items || [])) {
    const v = Math.abs(item.value || 0);
    totalDesp += v;
    if (item.isPaid) totalDespPago += v;
    const cat = item.categories?.[0]?.categoryName || 'SEM_CAT';
    despPorCat[cat] = (despPorCat[cat] || 0) + v;
  }

  results.despesas_junho = {
    totalItens: despData.items?.length,
    totalGeral: Math.round(totalDesp * 100) / 100,
    totalPago: Math.round(totalDespPago * 100) / 100,
    porCategoria: despPorCat,
  };

  // 3. Transações realizadas em Junho (extrato real)
  const txUrl = `https://api.nibo.com.br/empresas/v1/transactions?apitoken=${token}&$orderby=date desc&$top=200&$filter=year(date) eq 2026 AND month(date) eq 6`;
  const txR = await fetch(txUrl, { headers: { 'Accept': 'application/json' } });
  const txData = await txR.json();

  let totalEntradas = 0, totalSaidas = 0;
  for (const item of (txData.items || [])) {
    const v = item.amount || 0;
    if (v > 0) totalEntradas += v;
    else totalSaidas += Math.abs(v);
  }

  results.transacoes_junho = {
    totalItens: txData.items?.length,
    totalEntradas: Math.round(totalEntradas * 100) / 100,
    totalSaidas: Math.round(totalSaidas * 100) / 100,
    saldo: Math.round((totalEntradas - totalSaidas) * 100) / 100,
  };

  return res.status(200).json(results);
};
