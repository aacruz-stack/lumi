// Lumi · painel da dona: aba Caixa (venda no balcão). O agendamento pelo site não muda.
// Venda = carrinho: sessão por minuto, itens do catálogo e item avulso. Os preços finais são recalculados no servidor.
(function () {
  'use strict';
  var A = window.LumiAdmin;
  if (!A) return;
  var P = A.P, EXT = A.EXT, chamar = A.chamar;
  var SUBS = [['nova', 'Nova venda'], ['hoje', 'Vendas do dia']];
  var GRUPOS = [['sessao', 'Sessões'], ['pacote', 'Pacotes'], ['adicional', 'Adicionais e produtos']];
  var C = { sub: 'nova', itens: [], desconto: '', recebido: '', recAuto: true, forma: 'Pix', cliente: '', reserva: null, token: novoToken(), data: '', cat: null, catAt: 0, enviando: false };

  function novoToken() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'cx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function dec(v) {
    v = String(v === undefined || v === null ? '' : v).trim();
    if (v === '') return NaN;
    if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(v)) v = v.replace(/\./g, ''); // 1.200 = mil e duzentos
    var n = parseFloat(/,/.test(v) ? v.replace(/\./g, '').replace(',', '.') : v);
    return isFinite(n) ? n : NaN;
  }
  function cent(v) { return Math.round(v * 100); }
  function dbr(ds) { var p = String(ds).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ds; }
  function campo(rotulo, html, dica) { return '<label class="campo"><span>' + esc(rotulo) + '</span>' + html + (dica ? '<small class="aviso">' + dica + '</small>' : '') + '</label>'; }

  // mesma conta do servidor (só para a prévia): entre as sessões do catálogo, interpolando
  function precoMin(m, pts) {
    var n = pts.length, p;
    if (!n || !(m >= 1)) return null;
    if (n === 1 || m <= pts[0].min) p = pts[0].preco * m / pts[0].min;
    else if (m >= pts[n - 1].min) { var a = pts[n - 2], z = pts[n - 1]; p = z.preco + (m - z.min) * Math.max(0, (z.preco - a.preco) / (z.min - a.min)); }
    else for (var i = 1; i < n; i++) if (m <= pts[i].min) { p = pts[i - 1].preco + (m - pts[i - 1].min) * (pts[i].preco - pts[i - 1].preco) / (pts[i].min - pts[i - 1].min); break; }
    return Math.round(p);
  }

  function subC() { return C.itens.reduce(function (t, l) { return t + cent(l.preco) * (l.qtd || 1); }, 0); }
  function descC() { var d = dec(C.desconto); return isNaN(d) || d < 0 ? 0 : cent(d); }
  function totC() { return Math.max(0, subC() - descC()); }

  EXT.loaders.caixa = async function () {
    if (!C.cat || Date.now() - C.catAt > 300000) { C.cat = await chamar('adm_caixa_catalogo'); C.catAt = Date.now(); }
    P.dados.caixa = {};
    if (C.sub === 'hoje') P.dados.caixa.vendas = await chamar('adm_caixa_vendas', { data: C.data || A.hojeLocal() });
  };

  /* ---------- telas ---------- */
  function viewCaixa() {
    var h = '<div class="nav-painel" style="position:static;margin:0 0 12px;padding:0">' + SUBS.map(function (s) {
      return '<button type="button" data-cx="sub" data-v="' + s[0] + '" class="' + (C.sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>';
    }).join('') + '</div>';
    return h + (C.sub === 'hoje' ? viewDia(P.dados.caixa && P.dados.caixa.vendas) : viewNova());
  }
  EXT.views.caixa = viewCaixa;

  function viewNova() {
    var cat = C.cat;
    var h = C.reserva ? '<div class="msg info" style="margin-bottom:12px">Acrescentando itens à reserva de <b>' + esc(C.reserva.nome) + '</b> (código ' + esc(C.reserva.cod) + '). O pacote e o sinal dela não mudam: o que você adicionar aqui é cobrado à parte.' +
      '<div class="acoes"><button type="button" class="btn-discreto" data-cx="desligar">Desligar (venda comum)</button></div></div>' : '';
    h += '<div class="cartao"><h3 style="margin-bottom:6px">Sessão por minuto</h3>' +
      '<p class="min" style="margin-bottom:8px">O valor acompanha as sessões do catálogo.</p>' +
      '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end">' +
      campo('Quantos minutos?', '<input type="text" inputmode="numeric" id="cx-min" placeholder="Ex.: 50" maxlength="3">') +
      '<button type="button" class="btn-primario" style="margin-bottom:12px" data-cx="addmin">Adicionar</button></div>' +
      '<div class="min" id="cx-min-prev">Digite os minutos para ver o valor.</div></div>';
    GRUPOS.forEach(function (g) {
      var lista = cat.itens.filter(function (i) { return i.tipo === g[0]; });
      if (!lista.length) return;
      h += '<details class="cartao"' + (g[0] === 'adicional' ? ' open' : '') + '><summary style="cursor:pointer"><b>' + g[1] + '</b></summary><div style="margin-top:8px">' + lista.map(function (i) {
        return '<div class="linha" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(201,162,74,.15)">' +
          '<div><div>' + esc(i.nome) + '</div><div class="min">' + brl(i.preco) + (i.promo ? ' · promoção' : '') + (i.tipo === 'pacote' ? ' · ' + i.sessoes + ' sessão(ões)' : '') + '</div></div>' +
          '<button type="button" class="btn-discreto" style="width:auto;flex:0 0 auto;padding:8px 16px" data-cx="add" data-id="' + esc(i.id) + '" aria-label="Adicionar ' + esc(i.nome) + '">+ Adicionar</button></div>';
      }).join('') + '</div></details>';
    });
    h += '<details class="cartao"><summary style="cursor:pointer"><b>Outro item</b> <span class="min">(produto ou serviço fora do catálogo)</span></summary><div style="margin-top:8px">' +
      campo('O que é?', '<input type="text" id="cx-ln" maxlength="40" placeholder="Ex.: Protetor solar">') +
      campo('Valor (R$)', '<input type="text" inputmode="decimal" id="cx-lv" placeholder="Ex.: 25">') +
      '<div class="acoes"><button type="button" class="btn-discreto" data-cx="addlivre">Adicionar à venda</button></div></div></details>';
    h += '<h3 style="margin:18px 0 8px;color:var(--dourado-claro)">Venda</h3>' + carrinho();
    return h;
  }

  function carrinho() {
    if (!C.itens.length) return '<div class="vazio">Nada na venda ainda. Escolha acima. ✨</div>';
    var h = C.itens.map(function (l, i) {
      var q = l.qtd || 1;
      return '<div class="cartao" style="padding:10px 12px"><div class="linha" style="display:flex;justify-content:space-between;gap:10px"><span>' + esc(l.nome) + (q > 1 ? ' × ' + q : '') + '</span><b>' + brl(l.preco * q) + '</b></div>' +
        '<div style="display:flex;gap:8px;margin-top:6px">' +
        (l.t === 'catalogo' ? '<button type="button" class="btn-discreto" style="width:auto;padding:6px 14px" data-cx="menos" data-i="' + i + '" aria-label="Diminuir">−</button><button type="button" class="btn-discreto" style="width:auto;padding:6px 14px" data-cx="mais" data-i="' + i + '" aria-label="Aumentar">+</button>' : '') +
        '<button type="button" class="btn-perigo" style="width:auto;padding:6px 14px;margin-left:auto" data-cx="rem" data-i="' + i + '">Tirar</button></div></div>';
    }).join('');
    h += '<div class="cartao"><div class="linha" style="display:flex;justify-content:space-between"><span class="min">Soma dos itens</span><span id="cx-sub"></span></div>' +
      campo('Desconto (R$) (opcional)', '<input type="text" inputmode="decimal" id="cx-desc" placeholder="0" value="' + esc(C.desconto) + '">') +
      '<div class="linha" style="display:flex;justify-content:space-between;align-items:baseline;margin:6px 0 12px"><span class="nome">Total</span><span class="nome" id="cx-total" style="color:var(--dourado-claro);font-size:1.9rem"></span></div>' +
      campo('Quanto a cliente pagou agora (R$)', '<input type="text" inputmode="decimal" id="cx-rec" value="' + esc(C.recebido) + '">') +
      '<div class="msg info" id="cx-falta" style="display:none;margin:0 0 12px"></div>' +
      campo('Forma de pagamento', '<select id="cx-forma">' + C.cat.formas.map(function (f) { return '<option' + (f === C.forma ? ' selected' : '') + '>' + esc(f) + '</option>'; }).join('') + '</select>') +
      campo('Nome da cliente (opcional)', '<input type="text" id="cx-cli" maxlength="60" value="' + esc(C.cliente) + '" placeholder="Ex.: Maria">') +
      '<div class="acoes"><button type="button" class="btn-primario" data-cx="finalizar" id="cx-fin">Finalizar venda</button></div></div>';
    return h;
  }

  function atualizaTotais() {
    var s = document.getElementById('cx-sub'), t = document.getElementById('cx-total'); if (!s || !t) return;
    var tot = totC();
    s.textContent = brl(subC() / 100); t.textContent = brl(tot / 100);
    var rec = document.getElementById('cx-rec');
    if (C.recAuto && rec) { rec.value = String(tot / 100).replace('.', ','); C.recebido = rec.value; }
    var r = dec(C.recebido), f = document.getElementById('cx-falta'), btn = document.getElementById('cx-fin');
    var recC = C.recAuto ? tot : (isNaN(r) ? 0 : cent(r));
    if (f) {
      if (recC > tot) { f.style.display = ''; f.className = 'msg erro'; f.textContent = 'O valor pago não pode ser maior que o total.'; }
      else if (recC < tot) { f.style.display = ''; f.className = 'msg info'; f.textContent = 'Faltam ' + brl((tot - recC) / 100) + '. Esse valor fica como pendente de confirmar no Financeiro.'; }
      else f.style.display = 'none';
    }
    if (btn) {
      btn.disabled = C.enviando || tot <= 0 || recC > tot || descC() >= subC();
      if (!C.enviando) btn.textContent = (C.forma === 'Pix' && recC > 0) ? 'Gerar QR Code do Pix' : 'Finalizar venda';
    }
  }

  function viewDia(d) {
    var dia = C.data || A.hojeLocal();
    var h = campo('Dia', '<input type="date" id="cx-data" value="' + esc(dia) + '">');
    if (!d) return h;
    h += '<div class="cartao" style="text-align:center"><div class="min">Vendido no dia</div><div class="nome" style="font-size:1.9rem;color:var(--ok)">' + brl(d.total_vendido) + '</div>' +
      '<div class="min">Recebido: <b>' + brl(d.total_recebido) + '</b></div></div>';
    if (d.por_forma.length) h += '<div class="cartao"><div class="min" style="margin-bottom:6px">Recebido por forma de pagamento</div>' + d.por_forma.map(function (f) {
      return '<div class="linha" style="display:flex;justify-content:space-between;padding:4px 0"><span>' + esc(f.forma) + '</span><b>' + brl(f.total) + '</b></div>';
    }).join('') + '</div>';
    if (!d.vendas.length) return h + '<div class="vazio">Nenhuma venda neste dia.</div>';
    return h + d.vendas.map(function (v) {
      var resumo = v.itens.map(function (l) { return esc(l.nome) + ((l.qtd || 1) > 1 ? ' × ' + l.qtd : ''); }).join(', ');
      return '<div class="cartao" style="' + (v.desfeita ? 'opacity:.55' : '') + '"><div class="linha" style="display:flex;justify-content:space-between;gap:10px"><span class="nome" style="font-size:1.1rem">' + esc(v.cliente || 'Cliente') + '</span><b>' + brl(v.total) + '</b></div>' +
        '<div class="min">' + esc(v.hora) + ' · ' + esc(v.forma) + '</div><div class="min">' + resumo + '</div>' +
        (v.desconto > 0 ? '<div class="min">Desconto: ' + brl(v.desconto) + '</div>' : '') +
        '<div>' + (v.desfeita ? '<span class="chip erro">Venda desfeita</span>' : v.falta > 0 ? '<span class="chip ouro">Falta receber ' + brl(v.falta) + '</span>' : '<span class="chip ok">Pago</span>') + '</div>' +
        '<div class="acoes">' + (v.desfeita ? '' : '<button type="button" class="btn-perigo" data-cx="desfazer" data-id="' + esc(v.id) + '">Desfazer venda</button>') + '<button type="button" class="btn-discreto" data-cx="apagarvenda" data-id="' + esc(v.id) + '">Apagar de vez (teste)</button></div></div>';
    }).join('');
  }

  /* ---------- eventos ---------- */
  var root = document.getElementById('painel');
  root.addEventListener('input', function (ev) {
    var id = ev.target.id;
    if (id === 'cx-min') {
      var m = parseInt(ev.target.value, 10), el = document.getElementById('cx-min-prev');
      var p = (m >= 1 && m <= 480) ? precoMin(m, C.cat.pontos) : null;
      if (el) el.innerHTML = p === null ? 'Digite os minutos (de 1 a 480) para ver o valor.' : m + ' min = <b>' + brl(p) + '</b>';
    } else if (id === 'cx-desc') { C.desconto = ev.target.value; atualizaTotais(); }
    else if (id === 'cx-rec') { C.recebido = ev.target.value; C.recAuto = false; atualizaTotais(); }
    else if (id === 'cx-cli') C.cliente = ev.target.value;
  });
  root.addEventListener('change', function (ev) {
    if (ev.target.id === 'cx-forma') { C.forma = ev.target.value; atualizaTotais(); }
    if (ev.target.id === 'cx-data') { C.data = ev.target.value; A.abrir('caixa'); }
  });

  function redesenha() { A.desenhar(); atualizaTotais(); }

  // Pix: mostra o QR Code para a cliente pagar; a venda só é registrada depois de "Pagamento confirmado"
  async function pedirPix() {
    if (C.enviando) return;
    var tot = totC(); if (tot <= 0) return;
    var rec = C.recAuto ? tot / 100 : dec(C.recebido);
    if (isNaN(rec)) { toast('Digite quanto a cliente pagou agora.'); return; }
    if (cent(rec) > tot) { toast('O valor pago não pode ser maior que o total.'); return; }
    if (!(rec > 0)) return finalizar();
    C.enviando = true; atualizaTotais();
    var b = document.getElementById('cx-fin'); if (b) b.textContent = 'Gerando QR Code...';
    try {
      var px = await chamar('adm_caixa_pix', { valor: String(rec) });
      C.enviando = false; C.pix = { brcode: px.brcode, valor: px.valor, total: tot };
      var svg = '';
      try { var q = qrcode(0, 'M'); q.addData(px.brcode); q.make(); svg = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) { svg = ''; }
      A.abrirModal('<h3 style="margin-bottom:6px">Pix · ' + brl(px.valor) + '</h3><p class="min" style="margin-bottom:10px">Mostre o QR Code para a cliente escanear e pagar. Só confirme depois que o Pix cair na sua conta.</p>' +
        '<div style="background:#fff;padding:12px;border-radius:12px;max-width:260px;margin:0 auto 10px">' + (svg || '<div class="min" style="color:#333">Não consegui desenhar o QR Code. Use o código abaixo.</div>') + '</div>' +
        '<div class="acoes"><button type="button" class="btn-discreto" data-cx="pixcopiar">Copiar código (copia e cola)</button></div>' +
        '<div class="acoes duas"><button type="button" class="btn-discreto" data-cx="pixvoltar">Voltar</button><button type="button" class="btn-primario" data-cx="pixok">Pagamento confirmado ✓</button></div>');
    } catch (e) {
      C.enviando = false;
      if (/senha|tentativas/i.test(e.message)) return A.telaLogin(e.message);
      P.erro = e.message; A.desenhar(); atualizaTotais(); window.scrollTo({ top: 0 });
    }
  }

  async function finalizar() {
    if (C.enviando) return;
    var tot = totC(); if (tot <= 0) return;
    var rec = C.recAuto ? tot / 100 : dec(C.recebido), totalEnviado = tot;
    if (isNaN(rec)) { toast('Digite quanto a cliente pagou agora.'); return; }
    C.enviando = true; atualizaTotais();
    var b = document.getElementById('cx-fin'); if (b) b.textContent = 'Registrando...';
    try {
      var r = await chamar('adm_caixa_vender', {
        token: C.token, forma: C.forma, cliente: C.cliente, reserva: C.reserva ? C.reserva.cod : '', desconto: C.desconto, recebido: String(rec),
        itens: C.itens.map(function (l) { return l.t === 'catalogo' ? { tipo: 'catalogo', id: l.id, qtd: l.qtd } : l.t === 'minutos' ? { tipo: 'minutos', minutos: l.min } : { tipo: 'livre', nome: l.nome, valor: l.preco }; })
      });
      if (r.repetida && cent(r.total) !== totalEnviado) { // o servidor ja tinha uma venda com este envio: a de agora NAO foi gravada
        C.token = novoToken(); C.enviando = false;
        A.abrirModal('<h3 style="margin-bottom:8px">Atenção ✋</h3><div class="msg erro">Uma venda de <b>' + brl(r.total) + '</b> já tinha sido registrada neste envio (a conexão tinha caído). <b>A venda que está na tela NÃO foi gravada.</b></div><p class="min">Confira em "Vendas do dia". Se a venda antiga estiver errada, desfaça; depois finalize esta de novo.</p><div class="acoes"><button type="button" class="btn-primario" data-m="fechar">Entendi</button></div>');
        return;
      }
      C.itens = []; C.desconto = ''; C.recebido = ''; C.recAuto = true; C.cliente = ''; C.reserva = null; C.pix = null; C.token = novoToken(); C.enviando = false;
      var linhas = '<div class="msg ok">Venda de <b>' + brl(r.total) + '</b> registrada e lançada no Financeiro.</div>';
      if (r.pacotes_criados > 0) linhas += '<div class="msg info">' + r.pacotes_criados + ' pacote(s) criado(s) na aba <b>Pacotes</b>, com as sessões para você ir marcando como realizadas.</div>';
      if (r.pacote_aviso) linhas += '<div class="msg erro">' + esc(r.pacote_aviso) + '</div>';
      if (r.resto > 0) linhas += '<div class="msg info">Faltam ' + brl(r.resto) + ': ficou como pendente de confirmar no Financeiro.</div>';
      if (r.estoque_alertas && r.estoque_alertas.length) linhas += '<div class="msg erro"><b>Hora de repor:</b> ' + r.estoque_alertas.map(esc).join(', ') + '</div>';
      if (r.estoque_aviso) linhas += '<div class="msg erro">' + esc(r.estoque_aviso) + '</div>';
      if (r.financeiro_aviso) linhas += '<div class="msg erro">' + esc(r.financeiro_aviso) + '</div>';
      A.abrirModal('<h3 style="margin-bottom:8px">Venda registrada ✨</h3>' + linhas + '<div class="acoes"><button type="button" class="btn-primario" data-m="fechar">Fechar</button></div>');
    } catch (e) {
      C.enviando = false;
      if (/senha|tentativas/i.test(e.message)) return A.telaLogin(e.message);
      P.erro = e.message + (e.negocio ? '' : ' Não tenho certeza se a venda foi registrada: confira em "Vendas do dia" antes de tentar de novo.'); A.desenhar(); atualizaTotais(); window.scrollTo({ top: 0 });
    }
  }

  // "Acrescentar itens" nos cartões da Agenda/Pacotes: a venda do Caixa fica ligada à reserva
  EXT.vincular = function (cod, nome) { C.reserva = { cod: cod, nome: nome || 'cliente' }; C.cliente = nome || ''; C.sub = 'nova'; };

  var anterior = EXT.click;
  EXT.click = function (t, ev) {
    var c = t.dataset.cx;
    if (!c) return anterior ? anterior(t, ev) : false;
    if (c === 'sub') { C.sub = t.dataset.v; A.abrir('caixa'); return true; }
    if (c === 'add') {
      var it = C.cat.itens.filter(function (i) { return i.id === t.dataset.id; })[0]; if (!it) return true;
      var ex = C.itens.filter(function (l) { return l.t === 'catalogo' && l.id === it.id; })[0];
      if (ex) ex.qtd = Math.min(20, ex.qtd + 1); else C.itens.push({ t: 'catalogo', id: it.id, nome: it.nome, preco: it.preco, qtd: 1 });
      redesenha(); toast(it.nome + ' adicionado'); return true;
    }
    if (c === 'addmin') {
      var m = parseInt(val('cx-min'), 10);
      if (!(m >= 1 && m <= 480)) { toast('Digite os minutos (de 1 a 480).'); return true; }
      var p = precoMin(m, C.cat.pontos); if (p === null) { toast('Não há sessões no catálogo para calcular.'); return true; }
      C.itens.push({ t: 'minutos', min: m, nome: 'Sessão de ' + m + ' min', preco: p, qtd: 1 }); redesenha(); toast('Sessão de ' + m + ' min adicionada'); return true;
    }
    if (c === 'addlivre') {
      var nome = val('cx-ln').trim(), v = dec(val('cx-lv'));
      if (nome.length < 2 || isNaN(v) || v <= 0) { toast('Informe o nome e o valor do item.'); return true; }
      C.itens.push({ t: 'livre', nome: nome, preco: v, qtd: 1 }); redesenha(); toast('Item adicionado'); return true;
    }
    if (c === 'mais') { var a = C.itens[+t.dataset.i]; if (a) a.qtd = Math.min(20, a.qtd + 1); redesenha(); return true; }
    if (c === 'menos') { var b = C.itens[+t.dataset.i]; if (b) { if (b.qtd > 1) b.qtd--; else C.itens.splice(+t.dataset.i, 1); } redesenha(); return true; }
    if (c === 'rem') { C.itens.splice(+t.dataset.i, 1); redesenha(); return true; }
    if (c === 'finalizar') { if (C.forma === 'Pix') pedirPix(); else finalizar(); return true; }
    if (c === 'pixvoltar') { A.fecharModal(); return true; }
    if (c === 'pixok') { if (C.enviando) return true; P.modal = null; A.desenhar(); finalizar(); return true; }
    if (c === 'pixcopiar') {
      var tx = C.pix && C.pix.brcode;
      if (tx) { try { navigator.clipboard.writeText(tx).then(function () { toast('Código copiado!'); }, function () { toast('Não consegui copiar.'); }); } catch (e) { toast('Não consegui copiar.'); } }
      return true;
    }
    if (c === 'desligar') { C.reserva = null; C.cliente = ''; A.desenhar(); atualizaTotais(); return true; }
    if (c === 'apagarvenda') {
      A.modalConfirmar('Apagar esta venda de vez?', 'Apaga o registro da venda, o lançamento no Financeiro e o pacote criado por ela, e devolve o material ao estoque. Não dá para desfazer. Use para testes.', 'Apagar de vez', true, async function () {
        try { await chamar('adm_venda_excluir', { id: t.dataset.id }); P.modal = null; await A.abrir('caixa'); toast('Venda apagada'); }
        catch (e) { P.modal = null; P.erro = e.message; A.desenhar(); }
      });
      return true;
    }
    if (c === 'desfazer') {
      A.modalConfirmar('Desfazer esta venda?', 'Ela sai do caixa e do Financeiro, e o material volta ao estoque. Se você já devolveu o dinheiro para a cliente, é isso mesmo.', 'Desfazer venda', true, async function () {
        try { var r = await chamar('adm_caixa_desfazer', { id: t.dataset.id }); P.modal = null; await A.abrir('caixa'); toast(r.estoque_aviso || 'Venda desfeita'); }
        catch (e) { P.modal = null; P.erro = e.message; A.desenhar(); }
      });
      return true;
    }
    return false;
  };

  // depois de cada desenho da aba, recalcula os totais do carrinho
  var obs = new MutationObserver(function () { if (P.aba === 'caixa') atualizaTotais(); });
  obs.observe(root, { childList: true });
})();
