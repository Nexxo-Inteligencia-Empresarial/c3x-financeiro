module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  try {
    const results = {};

    // Sem filtro: busca os primeiros 3 transactions para ver estrutura bruta
    const txSemFiltroUrl = `https://api.nibo.com.br/empresas/v1/transactions?apitoken=${token}&$top=3`;
    const txSFR = await fetch(txSemFiltroUrl, { headers: { 'Accept': 'application/json' } });
    const txSFData = await txSFR.json();
    results.transactions_sem_filtro = {
      status: txSFR.status,
      chavesTopo: Object.keys(txSFData),
      totalItens: txSFData.items?.length ?? txSFData.value?.length ?? 'N/A',
      primeiroItem: (txSFData.items || txSFData.value || [])[0] || null,
    };

    // Tenta também o endpoint "entries" que alguns sistemas Nibo usam
    const entriesUrl = `https://api.nibo.com.br/empresas/v1/entries?apitoken=${token}&$top=3`;
    const entrR = await fetch(entriesUrl, { headers: { 'Accept': 'application/json' } });
    results.entries_status = entrR.status;

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
