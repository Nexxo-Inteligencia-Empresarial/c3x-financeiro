module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token, mes } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  const m = parseInt(mes) || 6;

  try {
    const results = {};

    // Receitas do mês (schedules/credit)
    const recUrl = `https://api.nibo.com.br/empresas/v1/schedules/credit?apitoken=${token}&$orderby=dueDate&$top=500&$filter=year(dueDate) eq 2026 AND month(dueDate) eq ${m}`;
    const recR = await fetch(recUrl, { headers: { 'Accept': 'application/json' } });
    const recData = await recR.json();

    let totalRecPago = 0, totalRecAberto = 0;
    const recPorCC = {};
    for (const item of (recData.items || [])) {
      const v = item.isPaid ? Math.abs(item.value || 0) : Math.abs(item.value || 0) - Math.abs(item.openValue || 0);
      if (v <= 0) continue;
      if (item.isPaid) totalRecPago += v; else totalRecAberto += v;
      const cc = item.costCenters?.[0]?.costCenterDescription || 'SEM_CC';
      if (!recPorCC[cc]) recPorCC[cc] = { pago: 0, aberto: 0, qtd: 0 };
      if (item.isPaid) recPorCC[cc].pago += v; else recPorCC[cc].aberto += v;
      recPorCC[cc].qtd++;
    }

    results.receitas = {
      mes: m,
      totalItens: recData.items?.length,
      totalPago: Math.round(totalRecPago * 100) / 100,
      totalAberto: Math.round(totalRecAberto * 100) / 100,
      porCentroCusto: recPorCC,
    };

    // Despesas do mês (schedules/debit)
    const despUrl = `https://api.nibo.com.br/empresas/v1/schedules/debit?apitoken=${token}&$orderby=dueDate&$top=500&$filter=year(dueDate) eq 2026 AND month(dueDate) eq ${m}`;
    const despR = await fetch(despUrl, { headers: { 'Accept': 'application/json' } });
    const despData = await despR.json();

    let totalDespPago = 0;
    const despPorCat = {};
    for (const item of (despData.items || [])) {
      if (!item.isPaid) continue;
      const v = Math.abs(item.value || 0);
      totalDespPago += v;
      const cat = item.categories?.[0]?.categoryName || 'SEM_CAT';
      despPorCat[cat] = (despPorCat[cat] || 0) + v;
    }

    results.despesas = {
      mes: m,
      totalItens: despData.items?.length,
      totalPago: Math.round(totalDespPago * 100) / 100,
      porCategoria: despPorCat,
    };

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
