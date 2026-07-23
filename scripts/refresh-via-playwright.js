'use strict';
// C3X Financeiro — Renovação de token usando o perfil já autenticado do Edge
// Estratégia: abre Edge com o perfil existente (já logado no Nibo) → lê token → salva no KV
// NÃO faz login do zero (evita MFA). Usa a sessão ativa do navegador.
//
// Pré-requisito: Edge não pode estar aberto com o perfil principal.
//   → Se Edge estiver aberto, feche-o primeiro ou use o bookmarklet (veja o README).

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs   = require('fs');
const path = require('path');

// Carrega .env.local
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
}

const VERCEL_URL    = (process.env.VERCEL_URL || 'https://c3x-financeiro.vercel.app').replace(/\/$/, '');
const SCRAPER_TOKEN = 'c3x-scraper-2026';
const EDGE_EXE      = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PROFILE  = `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\User Data`;

function log(msg) {
  const ts = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
  console.log(`[${ts}] ${msg}`);
}

async function salvarTokenNoKV(token, refreshToken) {
  const r = await fetch(`${VERCEL_URL}/api/kv?key=nibo_auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nibo-token': SCRAPER_TOKEN },
    body: JSON.stringify({ token, refreshToken: refreshToken || null, savedAt: new Date().toISOString() }),
  });
  const d = await r.json();
  if (!r.ok || !d.ok) throw new Error(`Falha ao salvar no KV: ${JSON.stringify(d)}`);
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
    if (!r.ok) throw new Error(`Scraper ${r.status}: ${d.message || d.error}`);
    return d;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  log('=== C3X Financeiro — Refresh Token (perfil Edge) ===');

  const { chromium } = require('playwright-core');

  log(`Abrindo Edge com perfil existente...`);
  log(`Perfil: ${EDGE_PROFILE}`);

  let browser;
  try {
    browser = await chromium.launchPersistentContext(EDGE_PROFILE, {
      executablePath: EDGE_EXE,
      headless: true,
      channel: 'msedge',
      args: [
        '--ignore-certificate-errors',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-background-networking',
      ],
      timeout: 15_000,
    });
  } catch (e) {
    if (e.message.includes('profile') || e.message.includes('lock') || e.message.includes('already')) {
      console.error('\n[AVISO] Edge está aberto com o perfil principal.');
      console.error('        Feche o Edge e tente novamente, ou use o bookmarklet:');
      console.error(`        ${VERCEL_URL}  →  abra no Edge logado no Nibo → clique no bookmarklet C3X`);
      process.exit(2);
    }
    throw e;
  }

  try {
    const pages = browser.pages();
    const page  = pages.length ? pages[0] : await browser.newPage();

    log('Navegando para empresa.nibo.com.br...');
    await page.goto('https://empresa.nibo.com.br', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const currentUrl = page.url();
    log(`URL atual: ${currentUrl}`);

    // Se foi redirecionado para o passport (sessão expirada)
    if (currentUrl.includes('passport.nibo.com.br')) {
      console.error('\n[AVISO] Sessão Nibo expirada — Edge não está logado.');
      console.error('        Abra o Edge, faça login no Nibo (com MFA) e tente novamente.');
      console.error('        Ou use o bookmarklet C3X enquanto estiver logado.');
      process.exit(2);
    }

    // Aguarda SPA carregar e o token aparecer no localStorage
    log('Aguardando token no localStorage...');
    await page.waitForFunction(
      () => !!localStorage.getItem('niboToken'),
      { timeout: 20_000, polling: 500 }
    );

    const token        = await page.evaluate(() => localStorage.getItem('niboToken'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('niboRefreshToken'));

    let expInfo = '';
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      if (payload.exp) expInfo = ` (válido até ${new Date(payload.exp * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`;
    } catch {}

    log(`✓ Token obtido${expInfo}`);

    await salvarTokenNoKV(token, refreshToken);
    log('✓ Token salvo no KV');

    log('Acionando scraper Vercel (pode levar até 60s)...');
    const result = await acionarScrape();
    log(`✓ ${result.credits} créditos, ${result.debits} débitos`);
    log(`✓ Dashboard atualizado: ${new Date(result.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    log('=== Concluído! ===');

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('\n[ERRO FATAL]', err.message);
  process.exit(1);
});
