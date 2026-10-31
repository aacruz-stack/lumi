// Lumi · painel da dona: aba Financeiro (resumo do mês, lançamentos e CMV). Usa os ganchos de admin.js.
// Linguagem simples: "quanto entrou", "quanto saiu", "sobrou no mês". O CMV só sugere, nunca muda preço.
(function () {
  'use strict';
  var A = window.LumiAdmin;
  if (!A) return;
  var P = A.P, EXT = A.EXT, chamar = A.chamar;
  var F = { sub: 'resumo', mes: '' }, FORM = null;
  var SUBS = [['resumo', 'Resumo do mês'], ['lanc', 'Lançamentos'], ['cmv', 'CMV']];
  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function campo(rotulo, html, dica) { return '<label class="campo"><span>' + esc(rotulo) + '</span>' + html + (dica ? '<small class="aviso">' + dica + '</small>' : '') + '</label>'; }
  function inp(id, v, extra) { return '<input type="text" id="' + id + '" value="' + esc(v === undefined || v === null ? '' : v) + '" ' + (extra || '') + '>'; }
  function dbr(ds) { var p = String(ds).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ds; }
  function pct(v) { return String(v).replace('.', ',') + '%'; }
  function mesNome(m) { var p = m.split('-'); return MESES[+p[1] - 1] + ' de ' + p[0]; }
  function mesMais(m, n) { var p = m.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function erroModal(msg) {
    var m = document.querySelector('.modal'); if (!m) return;
    var old = m.querySelector('.msg.erro'); if (old) old.remove();
    m.insertAdjacentHTML('afterbegin', '<div class="msg erro" role="alert">' + esc(msg) + '</div>'); m.scrollTop = 0;
  }
  function fin() { return P.dados.fin; }

  EXT.loaders.financeiro = async function () {
    if (!F.mes) F.mes = A.hojeLocal().slice(0, 7);
    P.dados.fin = await chamar('adm_fin_resumo', { mes: F.mes });
    if (F.sub === 'cmv') P.dados.cmv = await chamar('adm_cmv');
  };

  async function recarregar(msg) {
    P.modal = null; FORM = null;
    await A.abrir('financeiro');
    if (msg) toast(msg);
  }
  async function comBotao(id, rotulo, fn) {
    var b = document.getElementById(id); if (b) { b.disabled = true; b.textContent = 'Aguarde...'; }
    try { await fn(); }
    catch (e) {
      if (/senha|tentativas/i.test(e.message)) { P.modal = null; return A.telaLogin(e.message); }
      if (b) { b.disabled = false; b.textContent = rotulo; }
      erroModal(e.message);
    }
  }

  /* ---------- telas ---------- */
  function viewFinanceiro() {
    var h = '<div class="nav-painel" style="position:static;margin:0 0 12px;padding:0">' + SUBS.map(function (s) {
      return '<button type="button" data-fin="sub" data-v="' + s[0] + '" class="' + (F.sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>';
    }).join('') + '</div>';
    if (F.sub === 'cmv') return h + viewCmv(P.dados.cmv || { itens: [], faixa: { min: 25, max: 30 }, insumos_sem_custo: [] });
    return h + seletorMes() + (F.sub === 'lanc' ? viewLanc(fin()) : viewResumo(fin()));
  }
  EXT.views.financeiro = viewFinanceiro;

  function seletorMes() {
    return '<div class="linha" style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin:0 0 12px"><button type="button" class="btn-discreto" style="flex:0 0 auto;padding:8px 14px" data-fin="mes" data-n="-1" aria-label="Mês anterior">‹</button>' +
      '<div class="nome" style="text-align:center;flex:1">' + esc(mesNome(fin().mes)) + '</div>' +
      '<button type="button" class="btn-discreto" style="flex:0 0 auto;padding:8px 14px" data-fin="mes" data-n="1" aria-label="Próximo mês">›</button></div>';
  }

  function bloco(rotulo, valor, cor) {
    return '<div class="cartao" style="text-align:center"><div class="min">' + rotulo + '</div><div class="nome" style="font-size:1.9rem;color:var(--' + cor + ')">' + valor + '</div></div>';
  }
  function listaCats(titulo, arr, vazio) {
    if (!arr.length) return '<h3 style="margin:16px 0 6px;color:var(--dourado-claro)">' + titulo + '</h3><p class="min">' + vazio + '</p>';
    return '<h3 style="margin:16px 0 6px;color:var(--dourado-claro)">' + titulo + '</h3>' + arr.map(function (c) {
      return '<div class="linha" style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid rgba(201,162,74,.15)"><span>' + esc(c.categoria) + '</span><span>' + brl(c.total) + '</span></div>';
    }).join('');
  }
  function viewResumo(d) {
    var h = '';
    if (d.importar && d.importar.qtd) {
      h += '<div class="msg info"><b>Reservas já confirmadas fora do financeiro:</b> ' + d.importar.qtd + ' valor(es), somando ' + brl(d.importar.total) + '. ' +
        '<div class="acoes" style="margin-top:8px"><button type="button" class="btn-discreto" data-fin="importar">Ver e importar</button></div></div>';
    }
    h += bloco('Quanto entrou', brl(d.entradas), 'ok') + bloco('Quanto saiu', brl(d.saidas), 'erro') +
      bloco('Sobrou no mês', (d.resultado < 0 ? '− ' : '') + brl(Math.abs(d.resultado)), d.resultado < 0 ? 'erro' : 'ok');
    h += listaCats('De onde veio', d.por_categoria.entrada, 'Nada entrou neste mês ainda.');
    h += listaCats('Para onde foi', d.por_categoria.saida, 'Nada saiu neste mês ainda.');
    h += '<p class="min" style="margin-top:16px">O sinal entra sozinho quando você confirma o Pix, e o restante quando você marca "restante pago". Compras do estoque com valor pago também entram sozinhas. Contas e outros gastos você lança na aba Lançamentos.</p>';
    return h;
  }

  function viewLanc(d) {
    var h = '<div class="acoes"><button type="button" class="btn-primario" data-fin="novo">Novo lançamento</button></div>';
    if (!d.lancamentos.length) return h + '<div class="vazio">Nenhum lançamento neste mês. ✨</div>';
    return h + d.lancamentos.map(function (l) {
      var ent = l.tipo === 'entrada';
      return '<div class="cartao"><div class="linha"><span class="nome" style="font-size:1.1rem">' + esc(l.categoria) + '</span>' +
        '<span class="preco" style="color:var(--' + (ent ? 'ok' : 'erro') + ')">' + (ent ? '+ ' : '− ') + brl(l.valor) + '</span></div>' +
        '<div class="min">' + esc(dbr(l.data)) + (l.descricao ? ' · ' + esc(l.descricao) : '') + '</div>' +
        '<div>' + (l.origem === 'manual' ? '<span class="chip">Lançado por você</span>' : '<span class="chip ouro">Automático</span>') + '</div>' +
        '<div class="acoes duas">' + (l.origem === 'manual' ? '<button type="button" class="btn-discreto" data-fin="editar" data-id="' + esc(l.id) + '">Editar</button>' : '<span></span>') +
        '<button type="button" class="btn-perigo" data-fin="excluir" data-id="' + esc(l.id) + '">Excluir</button></div></div>';
    }).join('');
  }

  function viewCmv(d) {
    var h = '<p class="min" style="margin-bottom:10px">CMV é quanto do preço de cada procedimento vai para o material. O ideal é ficar entre <b>' + d.faixa.min + '% e ' + d.faixa.max + '%</b>. ' +
      'O sistema só <b>sugere</b>, nenhum preço muda sozinho. A conta usa a ficha técnica e o custo dos insumos (aba Estoque).</p>';
    if (d.insumos_sem_custo.length) h += '<div class="msg erro">Falta informar o custo de: <b>' + d.insumos_sem_custo.map(esc).join(', ') + '</b>. Sem isso o CMV dos procedimentos que usam esses insumos não fecha.</div>';
    var grupos = [['sessao', 'Sessões'], ['pacote', 'Pacotes'], ['adicional', 'Adicionais']];
    grupos.forEach(function (g) {
      var lista = d.itens.filter(function (i) { return i.tipo === g[0]; });
      if (!lista.length) return;
      h += '<h3 style="margin:18px 0 8px;color:var(--dourado-claro)">' + g[1] + '</h3>' + lista.map(cardCmv).join('');
    });
    return h;
  }
  function cardCmv(i) {
    var h = '<div class="cartao"><div class="linha"><span class="nome">' + esc(i.nome) + '</span><span class="preco">' + brl(i.preco) + '</span></div>';
    if (i.sem_ficha) return h + '<div class="min">Sem ficha técnica. Monte a ficha na aba Estoque para ver o CMV.</div></div>';
    if (i.incompleto) return h + '<div class="min">Ficha com insumo sem custo informado.</div><div><span class="chip">CMV indisponível</span></div></div>';
    if (i.cmv === undefined) return h + '<div class="min">Sem dados suficientes para calcular.</div></div>';
    var chip = i.faixa === 'ok' ? '<span class="chip ok">Na faixa ideal</span>' : i.faixa === 'alto' ? '<span class="chip erro">Material pesado no preço</span>' : '<span class="chip ouro">Margem folgada</span>';
    h += '<div class="min">Material ' + (i.tipo === 'pacote' ? 'do pacote inteiro (' + i.sessoes + ' sessões)' : i.tipo === 'adicional' ? 'por uso' : 'por sessão') + ': <b>' + brl(i.custo_total) + '</b></div>';
    h += '<div class="min">CMV: <b>' + pct(i.cmv) + '</b></div><div>' + chip + '</div>';
    if (i.faixa === 'alto') h += '<div class="msg info" style="margin:8px 0 0">Para ficar entre ' + F2(25) + ' e ' + F2(30) + ', o preço ficaria entre <b>' + brl(i.preco_min) + '</b> e <b>' + brl(i.preco_max) + '</b>. Sugestão: <b>' + brl(i.sugerido) + '</b>.</div>';
    else if (i.faixa === 'folgado') h += '<div class="min" style="margin-top:6px">O material pesa pouco no preço. Não precisa mudar nada.</div>';
    else h += '<div class="min" style="margin-top:6px">Preço bom, não precisa mudar.</div>';
    if (i.promo && i.cmv_promo !== undefined) h += '<div class="min" style="margin-top:4px">Na promoção "' + esc(i.promo.nome) + '" (' + brl(i.promo.preco) + ') o CMV é ' + pct(i.cmv_promo) + '.</div>';
    return h + '</div>';
  }
  function F2(n) { return n + '%'; }

  /* ---------- formulários ---------- */
  function colher() {
    FORM.tipo = val('f-tipo') || FORM.tipo; FORM.categoria = val('f-cat'); FORM.valor = val('f-valor'); FORM.data = val('f-data'); FORM.desc = val('f-desc');
  }
  function formLanc(l, manter) {
    if (!manter) FORM = l ? { id: l.id, tipo: l.tipo, categoria: l.categoria, valor: String(l.valor).replace('.', ','), data: l.data, desc: l.descricao } : { id: null, tipo: 'saida', categoria: '', valor: '', data: A.hojeLocal(), desc: '' };
    var cats = fin().categorias[FORM.tipo];
    A.abrirModal('<h3 style="margin-bottom:8px">' + (FORM.id ? 'Editar lançamento' : 'Novo lançamento') + '</h3>' +
      campo('O que aconteceu?', '<select id="f-tipo"><option value="saida"' + (FORM.tipo === 'saida' ? ' selected' : '') + '>Saiu dinheiro (gasto)</option><option value="entrada"' + (FORM.tipo === 'entrada' ? ' selected' : '') + '>Entrou dinheiro</option></select>') +
      campo('Categoria', '<select id="f-cat"><option value="">Escolha...</option>' + cats.map(function (c) { return '<option value="' + esc(c) + '"' + (c === FORM.categoria ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>') +
      campo('Valor (R$)', inp('f-valor', FORM.valor, 'inputmode="decimal" placeholder="Ex.: 150"')) +
      campo('Data', '<input type="date" id="f-data" value="' + esc(FORM.data) + '">') +
      campo('Observação (opcional)', inp('f-desc', FORM.desc, 'maxlength="80" placeholder="Ex.: conta de luz de outubro"')) +
      '<div class="acoes duas"><button type="button" class="btn-discreto" data-m="fechar">Voltar</button><button type="button" class="btn-primario" data-fin="salvar" id="btn-fin">Salvar</button></div>');
  }

  async function modalImportar() {
    try {
      var r = await chamar('adm_fin_importar', {});
      if (!r.candidatos.length) { toast('Nada para importar.'); return; }
      A.abrirModal('<h3 style="margin-bottom:6px">Importar reservas já confirmadas</h3>' +
        '<p class="min" style="margin-bottom:10px">Estes valores já foram recebidos mas ainda não estão no financeiro. Reservas de teste (nome começando com TESTE) ficam de fora.</p>' +
        r.candidatos.map(function (c) { return '<div class="linha" style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid rgba(201,162,74,.15)"><span>' + esc(c.descricao) + '<br><span class="min">' + esc(c.categoria) + ' · ' + esc(dbr(c.data)) + '</span></span><span>' + brl(c.valor) + '</span></div>'; }).join('') +
        '<p style="margin:10px 0"><b>Total: ' + brl(r.total) + '</b></p>' +
        '<div class="acoes duas"><button type="button" class="btn-discreto" data-m="fechar">Voltar</button><button type="button" class="btn-primario" data-fin="importar-ok" id="btn-imp">Importar tudo</button></div>');
    } catch (e) { P.erro = e.message; A.desenhar(); }
  }

  /* ---------- eventos ---------- */
  var root = document.getElementById('painel');
  root.addEventListener('change', function (ev) {
    if (ev.target.id === 'f-tipo' && FORM) { colher(); FORM.categoria = ''; formLanc(null, true); }
  });

  var anterior = EXT.click;
  EXT.click = function (t, ev) {
    var c = t.dataset.fin;
    if (!c) return anterior ? anterior(t, ev) : false;
    if (c === 'sub') { F.sub = t.dataset.v; A.abrir('financeiro'); return true; }
    if (c === 'mes') { F.mes = mesMais(fin().mes, +t.dataset.n); A.abrir('financeiro'); return true; }
    if (c === 'novo') { formLanc(null, false); return true; }
    if (c === 'editar') { formLanc(fin().lancamentos.filter(function (l) { return l.id === t.dataset.id; })[0], false); return true; }
    if (c === 'salvar') {
      colher();
      comBotao('btn-fin', 'Salvar', async function () {
        await chamar('adm_fin_salvar', { id: FORM.id, tipo: FORM.tipo, categoria: FORM.categoria, valor: FORM.valor, data: FORM.data, descricao: FORM.desc });
        await recarregar('Lançamento salvo!');
      });
      return true;
    }
    if (c === 'excluir') {
      var l = fin().lancamentos.filter(function (x) { return x.id === t.dataset.id; })[0];
      A.modalConfirmar('Excluir lançamento?', (l && l.origem !== 'manual' ? 'Este lançamento foi feito automaticamente. ' : '') + 'Ele sai do resumo do mês.', 'Excluir', true, async function () {
        try { await chamar('adm_fin_remover', { id: t.dataset.id }); await recarregar('Lançamento excluído'); }
        catch (e) { P.modal = null; P.erro = e.message; A.desenhar(); }
      });
      return true;
    }
    if (c === 'importar') { modalImportar(); return true; }
    if (c === 'importar-ok') {
      comBotao('btn-imp', 'Importar tudo', async function () {
        var r = await chamar('adm_fin_importar', { confirmar: true });
        await recarregar(r.importados + ' lançamento(s) importado(s)');
      });
      return true;
    }
    return false;
  };
})();
