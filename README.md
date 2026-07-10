# C3X Financeiro

Dashboard financeiro executivo da C3X Empreendimentos, desenvolvido para acompanhamento de receitas, despesas, inadimplência, fluxo de caixa e orçamento por centro de custo.

## Finalidade

Consolidar os dados financeiros do sistema Nibo em um painel visual e interativo, permitindo ao gestor financeiro acompanhar em tempo real:

- **Visão Executiva** — receita, despesa e resultado acumulado vs. projetado
- **Fluxo de Caixa** — movimentações semanais realizadas e previstas
- **Budget (DRE)** — orçado vs. realizado por categoria
- **Inadimplência** — recebimentos vencidos por faixa de atraso
- **Projeções** — tendências e gap acumulado de receita
- **Visão por Serviço** — Escola de Sócios, Prime, Destrava e outros centros de custo
- **Insights Financeiros** — análise mensal gerada automaticamente

## Hospedagem

Aplicação hospedada na **Vercel**:

> [https://c3x-financeiro.vercel.app](https://c3x-financeiro.vercel.app)

Os dados são armazenados no **Upstash KV** (Redis) e atualizados diariamente via cron job automático.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML + CSS + JavaScript (vanilla) |
| Gráficos | Chart.js 4.4 |
| Backend (API) | Vercel Serverless Functions (Node.js 24) |
| Banco de dados | Upstash KV (Redis via REST API) |
| Coleta de dados | Playwright MCP (scraper do Nibo) |
| Hospedagem | Vercel |
| Agendamento | Vercel Cron Jobs (diário às 10h UTC) |

## Arquitetura

```
Nibo (ERP) ──► Playwright Scraper ──► Upstash KV ──► API Vercel ──► Dashboard
```

O scraper autentica no Nibo, coleta lançamentos de crédito e débito, e salva o JSON no KV. O dashboard lê os dados via `/api/kv` e renderiza tudo no browser sem dependências de framework.

## Estrutura do projeto

```
c3x-financeiro/
├── index.html          # Dashboard completo (SPA)
├── api/
│   ├── kv.js           # Proxy para leitura/escrita no Upstash KV
│   ├── scrape.js       # Scraper do Nibo (roda via cron ou manualmente)
│   └── nibo-login.js   # Autenticação no Nibo para o cron automático
├── vercel.json         # Configuração de rotas, functions e cron
└── package.json
```

## Como executar localmente

### Pré-requisitos

- Node.js 20+
- Conta na Vercel com projeto vinculado
- Instância Upstash KV configurada no projeto Vercel

### 1. Instalar a CLI da Vercel

```bash
npm install -g vercel
```

### 2. Autenticar e vincular o projeto

```bash
vercel login
vercel link
```

### 3. Baixar as variáveis de ambiente

```bash
vercel env pull .env.local
```

### 4. Rodar localmente

```bash
vercel dev
```

O dashboard estará disponível em `http://localhost:3000`.

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `KV_REST_API_URL` | URL da instância Upstash KV |
| `KV_REST_API_TOKEN` | Token de leitura do KV |
| `KV_WRITE_TOKEN` | Token de escrita do KV (salvo no browser pelo usuário) |

## Atualização dos dados

Os dados são atualizados automaticamente **todo dia às 10h UTC** via cron job (`/api/scrape`).

Para atualizar manualmente, acesse a aba **Integrações** no dashboard e clique em **Recarregar dados do KV**, ou solicite ao Claude para executar o scraper via Playwright MCP.
