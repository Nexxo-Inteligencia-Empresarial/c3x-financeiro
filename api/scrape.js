const NIBO_ORG_ID = 'e0a0256d-0f98-445f-b3c5-bf4727b6c722';

async function kvGet(key, kvUrl, kvToken) {
  const r = await fetch(kvUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['GET', key])
  });
  const { result } = await r.json();
  if (result == null) return null;
  return typeof result === 'string' ? JSON.parse(result) : result;
}

async function kvSet(key, value, kvUrl, kvToken) {
  const r = await fetch(kvUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, JSON.stringify(value)])
  });
  const { result } = await r.json();
  return result === 'OK';
}

function isExpired(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return Date.now() / 1000 > payload.exp - 300;
  } catch { return true; }
}

async function refreshToken(refreshToken) {
  const r = await fetch('https://auth.nibo.com.br/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'empresa-web'
    }).toString()
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Refresh falhou ${r.status}: ${txt.slice(0, 120)}`);
  }
  return r.json();
}

async function fetchAllEntries(token) {
  const headers = { 'Authorization': `Bearer ${token}`, 'organization': NIBO_ORG_ID };
  const all = [];
  let page = 1;
  while (true) {
    // Busca lote de 10 páginas em paralelo
    const pages = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        fetch(`https://api-empresa.nibo.com.br/reports/entries?page=${page + i}&pageSize=50`, { headers })
          .then(r => r.json()).catch(() => [])
      )
    );
    let done = false;
    for (const d of pages) {
      if (!Array.isArray(d) || d.length === 0) { done = true; break; }
      all.push(...d);
      if (d.length < 50) { done = true; break; }
    }
    if (done) break;
    page += 10;
    if (page > 600) break;
  }
  return all;
}

async function fetchSchedules(token, type) {
  const headers = {
    'Authorization': `Bearer ${token}`, 'organization': NIBO_ORG_ID,
    'Content-Type': 'application/json'
  };
  const items = [];
  let page = 1;
  while (true) {
    const r = await fetch('https://api-empresa.nibo.com.br/reports/schedules', {
      method: 'POST', headers,
      body: JSON.stringify({ page, type, orderByField: 'scheduleDate', sortingOrder: 'asc', visionType: 1 })
    });
    const d = await r.json();
    const batch = Array.isArray(d) ? d : (d.items || []);
    if (!batch.length) break;
    items.push(...batch);
    if (batch.length < 10) break;
    page++;
    if (page > 50) break;
  }
  return items;
}

function toEntry(e) {
  const date = (e.entryDate || e.dueDate || '').slice(0, 10);
  return {
    isEntry: true, isPaid: true,
    value: Math.abs(e.entryValue || 0), openValue: 0,
    paymentDate: date, dueDate: date,
    scheduleDate: (e.scheduleDate || e.dueDate || '').slice(0, 10),
    description: e.scheduleDescription || e.identifier || '',
    categories: (e.categories || []).map(c => ({
      categoryName: c.categoryName || '', categoryType: c.categoryType || '', groupRef: c.groupRef || ''
    })),
    costCenters: (e.costCenters || []).map(c => ({
      costCenterDescription: c.costCenterDescription || c.description || c.name || ''
    })),
    stakeholder: { name: e.entityName || '' },
    accountDescription: e.accountDescription || ''
  };
}

function toSchedule(s) {
  const val = Math.abs(s.openValue || s.value || 0);
  return {
    isEntry: false, isPaid: false,
    value: val, openValue: 0, paymentDate: null,
    dueDate: (s.dueDate || s.scheduleDate || '').slice(0, 10),
    scheduleDate: (s.scheduleDate || '').slice(0, 10),
    description: s.scheduleDescription || s.description || '',
    categories: (s.categories || []).map(c => ({
      categoryName: c.categoryName || '', categoryType: c.categoryType || '', groupRef: c.groupRef || ''
    })),
    costCenters: (s.costCenters || []).map(c => ({
      costCenterDescription: c.costCenterDescription || c.description || c.name || ''
    })),
    stakeholder: { name: s.entityName || s.stakeholder?.name || '' }
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Nibo-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Autorização: cron (Bearer CRON_SECRET) ou chamada manual (x-nibo-token)
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers['authorization'] || '';
  const scraperToken = req.headers['x-nibo-token'] || '';
  const ok = (cronSecret && auth === `Bearer ${cronSecret}`) || scraperToken === 'c3x-scraper-2026';
  if (!ok) return res.status(401).json({ error: 'não autorizado' });

  const kvUrl   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN  || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) return res.status(503).json({ error: 'KV não configurado' });

  try {
    const niboAuth = await kvGet('nibo_auth', kvUrl, kvToken);
    if (!niboAuth?.token) {
      return res.status(401).json({
        error: 'nibo_auth ausente no KV — abra o dashboard para salvar o token automaticamente'
      });
    }

    let token = niboAuth.token;

    if (isExpired(token)) {
      if (!niboAuth.refreshToken) {
        return res.status(401).json({ error: 'token expirado e sem refresh token — abra o dashboard' });
      }
      const refreshed = await refreshToken(niboAuth.refreshToken);
      token = refreshed.access_token;
      await kvSet('nibo_auth', {
        token,
        refreshToken: refreshed.refresh_token || niboAuth.refreshToken,
        savedAt: new Date().toISOString()
      }, kvUrl, kvToken);
    }

    const [allEntries, projCred, projDeb] = await Promise.all([
      fetchAllEntries(token),
      fetchSchedules(token, 'credit'),
      fetchSchedules(token, 'debit')
    ]);

    const credits = [
      ...allEntries.filter(e => (e.entryValue || 0) >= 0).map(toEntry),
      ...projCred.filter(s => Math.abs(s.openValue || s.value || 0) > 0).map(toSchedule)
    ];
    const debits = [
      ...allEntries.filter(e => (e.entryValue || 0) < 0).map(toEntry),
      ...projDeb.filter(s => Math.abs(s.openValue || s.value || 0) > 0).map(toSchedule)
    ];

    const payload = { updatedAt: new Date().toISOString(), credits, debits, categories: [] };
    await kvSet('nibo_data', payload, kvUrl, kvToken);

    return res.json({ ok: true, updatedAt: payload.updatedAt, credits: credits.length, debits: debits.length });
  } catch (err) {
    console.error('[scrape]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
