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

const NIBO_AUTH_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Origin': 'https://empresa.nibo.com.br',
  'Referer': 'https://empresa.nibo.com.br/',
};

async function refreshToken(rt) {
  const r = await fetch('https://auth.nibo.com.br/connect/token', {
    method: 'POST',
    headers: NIBO_AUTH_HEADERS,
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: rt,
      client_id: 'empresa-web',
      scope: 'openid empresa-api offline_access',
    }).toString()
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Refresh falhou ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

async function loginWithPassword(email, password) {
  const r = await fetch('https://auth.nibo.com.br/connect/token', {
    method: 'POST',
    headers: NIBO_AUTH_HEADERS,
    body: new URLSearchParams({
      grant_type: 'password',
      username: email,
      password,
      client_id: 'empresa-web',
      scope: 'openid empresa-api offline_access',
    }).toString()
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Login falhou ${r.status}: ${txt.slice(0, 200)}`);
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
        error: 'TOKEN_AUSENTE',
        message: 'nibo_auth não encontrado no KV. Execute: scripts\\run-scrape.bat'
      });
    }

    let token = niboAuth.token;

    if (isExpired(token)) {
      let refreshed = null;

      // Tentativa 1: refresh token
      if (niboAuth.refreshToken) {
        try {
          refreshed = await refreshToken(niboAuth.refreshToken);
        } catch (e) {
          console.warn('[scrape] refresh_token falhou:', e.message);
        }
      }

      // Tentativa 2: password grant (NIBO_EMAIL + NIBO_PASSWORD nas env vars)
      // Nota: auth.nibo.com.br pode bloquear IPs de datacenter — se falhar, use scripts/run-scrape.bat
      if (!refreshed) {
        const email = process.env.NIBO_EMAIL;
        const password = process.env.NIBO_PASSWORD;
        if (email && password) {
          try {
            refreshed = await loginWithPassword(email, password);
          } catch (e) {
            console.warn('[scrape] password grant falhou (IP bloqueado?):', e.message);
          }
        }
      }

      if (!refreshed) {
        return res.status(401).json({
          error: 'TOKEN_EXPIRADO',
          message: 'Token Nibo expirado e renovação automática falhou (auth.nibo.com.br bloqueia Vercel). Execute: scripts\\run-scrape.bat'
        });
      }

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
