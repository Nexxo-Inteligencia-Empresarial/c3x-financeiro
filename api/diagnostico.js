module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  const base = `https://api.nibo.com.br/empresas/v1`;
  const h = { 'Accept': 'application/json' };

  async function nibo(endpoint, filter) {
    const url = `${base}/${endpoint}?apitoken=${encodeURIComponent(token)}&$top=500&$filter=${filter}`;
    const r = await fetch(url, { headers: h });
    const data = await r.json();
    return { status: r.status, items: data.items || [], erro: data.message || null };
  }

  try {
    const results = {};

    // A: filtro atual por dueDate janeiro
    const a = await nibo('schedules/credit', 'year(dueDate) eq 2026 AND month(dueDate) eq 1');
    results.A_dueDate_jan = {
      status: a.status, qtd: a.items.length, erro: a.erro,
      total_pago: a.items.filter(i=>i.isPaid).reduce((s,i)=>s+Math.abs(i.value||0),0).toFixed(2),
      total_value_minus_open: a.items.reduce((s,i)=>s+Math.max(0,Math.abs(i.value||0)-Math.abs(i.openValue||0)),0).toFixed(2),
    };

    // B: filtro por paymentDate — testa se Nibo suporta
    const b = await nibo('schedules/credit', 'isPaid eq true AND year(paymentDate) eq 2026 AND month(paymentDate) eq 1');
    results.B_paymentDate_jan = {
      status: b.status, qtd: b.items.length, erro: b.erro,
      total: b.items.reduce((s,i)=>s+Math.abs(i.value||0),0).toFixed(2),
    };

    // C: todos pagos de 2026 — quantos têm paymentDate preenchido?
    const c = await nibo('schedules/credit', 'isPaid eq true AND year(dueDate) eq 2026');
    const comPay = c.items.filter(i=>i.paymentDate);
    results.C_pagos2026 = {
      status: c.status, qtd: c.items.length, erro: c.erro,
      comPaymentDate: comPay.length,
      semPaymentDate: c.items.filter(i=>!i.paymentDate).length,
      exemploComPaymentDate: comPay[0] ? {
        desc: comPay[0].description, dueDate: comPay[0].dueDate,
        paymentDate: comPay[0].paymentDate, value: comPay[0].value
      } : null,
    };

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
