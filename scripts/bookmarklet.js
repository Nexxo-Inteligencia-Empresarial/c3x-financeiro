// C3X Financeiro — Bookmarklet de renovação de token
// ====================================================
// Cole o conteúdo de BOOKMARKLET_URL abaixo como URL de um favorito no Edge.
// Ao clicar no favorito ENQUANTO ESTIVER EM empresa.nibo.com.br, ele:
//   1. Lê o niboToken do localStorage do Nibo
//   2. Salva no KV do dashboard
//   3. Aciona o scraper para atualizar os dados
//
// COMO ADICIONAR:
//   1. Abra o Edge → Ctrl+Shift+O (favoritos)
//   2. Clique em "Adicionar favorito" → cole o texto BOOKMARKLET_URL como URL
//   3. Nomeie como "C3X Atualizar"
//   4. Salve na barra de favoritos
//
// USO DIÁRIO:
//   1. Abra empresa.nibo.com.br (já logado)
//   2. Clique no favorito "C3X Atualizar"
//   3. Aguarde a mensagem de confirmação (~30s)

const BOOKMARKLET_URL = `javascript:(async()=>{const t=localStorage.getItem('niboToken');const r=localStorage.getItem('niboRefreshToken');if(!t){alert('Token nao encontrado. Faca login no Nibo primeiro.');return;}const s=new Date().toISOString();try{const r1=await fetch('https://c3x-financeiro.vercel.app/api/kv?key=nibo_auth',{method:'POST',headers:{'Content-Type':'application/json','x-nibo-token':'c3x-scraper-2026'},body:JSON.stringify({token:t,refreshToken:r,savedAt:s})});const d1=await r1.json();if(!d1.ok){alert('Erro ao salvar token: '+JSON.stringify(d1));return;}const r2=await fetch('https://c3x-financeiro.vercel.app/api/scrape',{headers:{'x-nibo-token':'c3x-scraper-2026'}});const d2=await r2.json();if(d2.ok){alert('Dashboard atualizado!\\n'+d2.credits+' creditos, '+d2.debits+' debitos\\n'+new Date(d2.updatedAt).toLocaleString('pt-BR'));}else{alert('Scraper falhou: '+(d2.error||JSON.stringify(d2)));}}catch(e){alert('Erro: '+e.message);}})();`;

// Apenas para referência — o valor acima é o que deve ser colado como URL do favorito
