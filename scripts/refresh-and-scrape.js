'use strict';
// Permite certificados SSL corporativos (proxy de inspeção SSL)
// Necessário em redes com Zscaler, Netskope ou similar
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// C3X Financeiro — Scraper local
// Roda na sua máquina (sem bloqueio de IP do Nibo) para:
//   1. Autenticar no Nibo localmente (auth.nibo.com.br não bloqueia sua máquina)
//   2. Salvar o token fresco no KV via endpoint Vercel
//   3. Acionar o scraper Vercel para buscar os dados do Nibo
//
// Variáveis necessárias no .env.local: NIBO_EMAIL, NIBO_PASSWORD
// Não precisa de credenciais KV — usa o endpoint /api/kv da Vercel.

const fs   = require('fs');
const path = require('path');

// Carrega .env.local
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  });
} else {
  console.error('[ERRO] .env.local não encontrado em', envFile);
  console.error('       Copie .env.local.example → .env.local e preencha os valores.');
  process.exit(1);
}

const NIBO_EMAIL    = process.env.NIBO_EMAIL;
const NIBO_PASSWORD = process.env.NIBO_PASSWORD;
const VERCEL_URL    = (process.env.VERCEL_URL || 'https://c3x-financeiro.vercel.app').replace(/\/$/, '');
const SCRAPER_TOKEN = 'c3x-scraper-2026';

function log(msg) {
  const ts = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
  console.log(`[${ts}] ${msg}`);
}

async function loginNibo() {
  const r = await fetch('https://auth.nibo.com.br/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Origin':     'https://empresa.nibo.com.br',
      'Referer':    'https://empresa.nibo.com.br/',
      'Accept':     'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username:   NIBO_EMAIL,
      password:   NIBO_PASSWORD,
      client_id:  'empresa-web',
      scope:      'openid empresa-api offline_access',
    }).toString(),
  });

  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch {
    throw new Error(`Resposta não-JSON do Nibo (${r.status}): ${txt.slice(0, 400)}`);
  }

  if (!r.ok || !data.access_token) {
    const msg = data.error_description || data.error || JSON.stringify(data).slice(0, 200);
    throw new Error(`Login Nibo falhou (${r.status}): ${msg}`);
  }
  return data;
}

async function salvarTokenNoKV(token, refreshToken) {
  const r = await fetch(`${VERCEL_URL}/api/kv?key=nibo_auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nibo-token': SCRAPER_TOKEN,
    },
    body: JSON.stringify({ token, refreshToken: refreshToken || null, savedAt: new Date().toISOString() }),
  });
  const d = await r.json();
  if (!r.ok || !d.ok) throw new Error(`Falha ao salvar token no KV: ${JSON.stringify(d)}`);
}

async function acionarScrape() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const r = await fetch(`${VERCEL_URL}/api/scrape`, {
      headers: { 'x-nibo-token': SCRAPER_TOKEN },
      signal: controller.signal,
    });
    const d = await r.json();
    if (!r.ok) {
      throw new Error(`Scraper retornou ${r.status}: ${d.message || d.error || JSON.stringify(d)}`);
    }
    return d;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  log('=== C3X Financeiro — Scraper Local ===');

  if (!NIBO_EMAIL)    { console.error('[ERRO] Configure NIBO_EMAIL no .env.local'); process.exit(1); }
  if (!NIBO_PASSWORD) { console.error('[ERRO] Configure NIBO_PASSWORD no .env.local'); process.exit(1); }

  // 1. Auth local (sua máquina não é bloqueada pelo Nibo)
  log(`Login no Nibo como ${NIBO_EMAIL}...`);
  const auth = await loginNibo();
  const expiresMin = Math.round((auth.expires_in || 3600) / 60);
  log(`✓ Login OK — token válido por ${expiresMin} minutos`);

  // 2. Salva token fresco no KV via Vercel
  log('Salvando token no KV...');
  await salvarTokenNoKV(auth.access_token, auth.refresh_token);
  log('✓ Token salvo');

  // 3. Vercel busca os dados usando o token recém-salvo
  log('Acionando scraper Vercel (pode levar até 60s)...');
  const result = await acionarScrape();
  log(`✓ Scrape OK — ${result.credits} créditos, ${result.debits} débitos`);
  log(`✓ Dashboard atualizado: ${new Date(result.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  log('=== Concluído! ===');
}

main().catch(err => {
  console.error('\n[ERRO FATAL]', err.message);
  process.exit(1);
});
