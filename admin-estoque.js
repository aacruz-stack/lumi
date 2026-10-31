// Lumi · painel da dona: aba Estoque (insumos, fichas técnicas e movimentos). Usa os ganchos de admin.js.
// Linguagem simples: a dona diz quanto PAGOU e o que VEIO na embalagem; o sistema faz a conta do custo.
(function () {
  'use strict';
  var A = window.LumiAdmin;
  if (!A) return;
  var P = A.P, EXT = A.EXT, chamar = A.chamar;
  var E = { sub: 'insumos' }, FORM = null;
  var SUBS = [['insumos', 'Insumos'], ['fichas', 'Fichas técnicas'], ['movs', 'Movimentos']];
  var TIPOS = { sessao: 'Sessões', pacote: 'Pacotes', adicional: 'Adicionais' };
  var MOV = { entrada: 'Compra / entrada', saida: 'Saída', ajuste: 'Contagem', baixa_sessao: 'Sessão realizada', estorno_sessao: 'Sessão desfeita', baixa_venda: 'Venda no local', estorno_venda: 'Venda desfeita' };
  // como a dona mede: [valor guardado, rótulo]. Quem digita em kg ou litro é convertido sozinho.
  var MEDIDAS = [['g', 'Gramas (g)'], ['ml', 'Mililitros (ml)'], ['un', 'Unidades (un)'], ['outra', 'Outra...']];
  var FAMILIA = { g: [['g', 1], ['kg', 1000]], ml: [['ml', 1], ['litro', 1000]] };
  var EXTENSO = { g: 'grama', ml: 'ml', un: 'unidade' };

  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function chk(id) { var e = document.getElementById(id); return !!(e && e.checked); }
  function dec(v) { var n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/\./g, function (m, i, s) { return /,/.test(s) ? '' : '.'; }).replace(',', '.')); return isFinite(n) ? n : NaN; }
  function num(v) { return String(Math.round(Number(v) * 1000) / 1000).replace('.', ','); }
  function dinheiro(v) { var n = Number(v); var t = n >= 1 ? n.toFixed(2) : String(Math.round(n * 10000) / 10000); if (n < 1 && t.indexOf('.') < 0) t += '.00'; var p = t.split('.'); if (p[1] && p[1].length < 2) p[1] += '0'; return 'R$ ' + p.join(','); }
  function qtdBonita(q, un) { // 1500 g -> "1,5 kg (1500 g)"
    var f = FAMILIA[un];
    if (f && Math.abs(q) >= 1000) return num(q / 1000) + ' ' + f[1][0] + ' (' + num(q) + ' ' + un + ')';
    return num(q) + ' ' + un;
  }
  function dbr(ds) { var p = String(ds).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ds; }
  function campo(rotulo, html, dica) { return '<label class="campo"><span>' + esc(rotulo) + '</span>' + html + (dica ? '<small class="aviso">' + dica + '</small>' : '') + '</label>'; }
  function inp(id, v, extra) { return '<input type="text" id="' + id + '" value="' + esc(v === undefined || v === null ? '' : v) + '" ' + (extra || '') + '>'; }
  function erroModal(msg) {
    var m = document.querySelector('.modal'); if (!m) return;
    var old = m.querySelector('.msg.erro'); if (old) old.remove();
    m.insertAdjacentHTML('afterbegin', '<div class="msg erro" role="alert">' + esc(msg) + '</div>'); m.scrollTop = 0;
  }
  function insumo(id) { return (P.dados.estoque.insumos || []).filter(function (i) { return i.id === id; })[0]; }
  function item(id) { return (P.dados.estoque.itens || []).filter(function (i) { return i.id === id; })[0]; }

  // campo "quantidade + unidade": se a medida tem kg/litro, mostra um seletor e converte para a unidade base
  function campoQtd(id, rotulo, base, valor, dica, unSel) {
    var f = FAMILIA[base], sel;
    if (f) sel = '<select id="' + id + '-u">' + f.map(function (o) { return '<option value="' + o[1] + '"' + (o[0] === (unSel || base) ? ' selected' : '') + '>' + o[0] + '</option>'; }).join('') + '</select>';
    else sel = '<span class="min" style="align-self:center">' + esc(base) + '</span>';
    return campo(rotulo, '<div style="display:grid;grid-template-columns:1fr auto;gap:8px">' + inp(id, valor, 'inputmode="decimal" placeholder="0"') + sel + '</div>', dica);
  }
  function lerQtd(id) { // -> número na unidade base (ou NaN)
    var v = dec(val(id)), u = document.getElementById(id + '-u');
    return isNaN(v) ? NaN : Math.round(v * (u ? +u.value : 1) * 1000) / 1000;
  }
  function baseDoForm() { // unidade do insumo em edição/criação
    if (FORM && FORM.id) return insumo(FORM.id).unidade;
    var s = val('i-un-sel') || FORM.un || 'g';
    return s === 'outra' ? (val('i-un-outra').trim() || 'un') : s;
  }

  EXT.loaders.estoque = async function () { P.dados.estoque = await chamar('adm_estoque'); };

  async function recarregar(msg) {
    P.modal = null; FORM = null;
    await A.abrir('estoque');
    if (msg) toast(msg);
  }
  async function comBotao(id, rotulo, fn) {
    var b = document.getElementById(id); if (b) { b.disabled = true; b.textContent = 'Salvando...'; }
    try { await fn(); }
    catch (e) {
      if (/senha|tentativas/i.test(e.message)) { P.modal = null; return A.telaLogin(e.message); }
      if (b) { b.disabled = false; b.textContent = rotulo; }
      erroModal(e.message);
    }
  }

  /* ---------- telas ---------- */
  function viewEstoque() {
    var d = P.dados.estoque || { insumos: [], itens: [], fichas: {}, movs: [], alertas: [] };
    var h = '<div class="nav-painel" style="position:static;margin:0 0 12px;padding:0">' + SUBS.map(function (s) {
      return '<button type="button" data-est="sub" data-v="' + s[0] + '" class="' + (E.sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>';
    }).join('') + '</div>';
    if (E.sub === 'insumos') return h + viewInsumos(d);
    if (E.sub === 'fichas') return h + viewFichas(d);
    return h + viewMovs(d);
  }
  EXT.views.estoque = viewEstoque;

  function viewInsumos(d) {
    var h = '';
    if (d.alertas.length) h += '<div class="msg erro" role="alert"><b>Hora de repor:</b> ' + d.alertas.map(esc).join(', ') + '</div>';
    h += '<div class="acoes"><button type="button" class="btn-primario" data-est="insumo-novo">Novo insumo</button></div>';
    if (!d.insumos.length) return h + '<div class="vazio">Nenhum insumo cadastrado ainda. Comece pelo botão acima. ✨</div>';
    return h + d.insumos.map(function (i) {
      return '<div class="cartao" style="' + (i.ativo ? '' : 'opacity:.6') + '"><div class="linha"><span class="nome">' + esc(i.nome) + '</span>' +
        '<span class="preco">' + esc(qtdBonita(i.qtd_atual, i.unidade)) + '</span></div>' +
        '<div class="min">Avisar para repor quando chegar a ' + esc(qtdBonita(i.ponto_reposicao, i.unidade)) + '</div>' +
        (i.custo_unit !== null ? '<div class="min">Custo: ' + dinheiro(i.custo_unit) + ' por ' + esc(EXTENSO[i.unidade] || i.unidade) + '</div>' : '<div class="min">Custo ainda não informado.</div>') +
        '<div>' + (i.alerta ? '<span class="chip erro">Repor</span>' : '<span class="chip ok">Em dia</span>') + (i.ativo ? '' : '<span class="chip">Inativo</span>') + '</div>' +
        '<div class="acoes duas"><button type="button" class="btn-primario" data-est="mov" data-t="entrada" data-id="' + esc(i.id) + '">Comprei mais</button>' +
        '<button type="button" class="btn-discreto" data-est="mov" data-t="saida" data-id="' + esc(i.id) + '">Saiu / perdi</button></div>' +
        '<div class="acoes duas"><button type="button" class="btn-discreto" data-est="mov" data-t="ajuste" data-id="' + esc(i.id) + '">Contei o estoque</button>' +
        '<button type="button" class="btn-discreto" data-est="insumo-editar" data-id="' + esc(i.id) + '">Editar</button></div></div>';
    }).join('');
  }

  function fichaTexto(d, itemId) {
    var l = d.fichas[itemId] || [];
    if (!l.length) return '<span class="min">Sem ficha técnica: não dá baixa no estoque.</span>';
    var custo = 0, completo = true;
    var h = l.map(function (x) {
      var i = insumo(x.insumo_id);
      if (i && i.custo_unit !== null) custo += i.custo_unit * x.qtd; else completo = false;
      return '<div class="min">• ' + esc(i ? i.nome : x.insumo_id) + ': ' + num(x.qtd) + ' ' + esc(i ? i.unidade : '') + '</div>';
    }).join('');
    return h + (completo ? '<div class="min" style="margin-top:4px">Gasto de material por sessão: <b>' + dinheiro(custo) + '</b></div>' : '');
  }
  function viewFichas(d) {
    var h = '<p class="min" style="margin-bottom:10px">Quanto de cada insumo uma sessão gasta. O estoque desce sozinho quando você marca a sessão como realizada. Nos adicionais, desce junto com a 1ª sessão da reserva.</p>';
    if (!d.insumos.length) return h + '<div class="vazio">Cadastre os insumos primeiro, na aba Insumos.</div>';
    ['sessao', 'pacote', 'adicional'].forEach(function (tipo) {
      var lista = d.itens.filter(function (i) { return i.tipo === tipo; });
      if (!lista.length) return;
      h += '<h3 style="margin:18px 0 8px;color:var(--dourado-claro)">' + TIPOS[tipo] + '</h3>';
      h += lista.map(function (i) {
        return '<div class="cartao"><div class="linha"><span class="nome">' + esc(i.nome) + '</span></div>' + fichaTexto(d, i.id) +
          '<div class="acoes"><button type="button" class="btn-discreto" data-est="ficha-editar" data-id="' + esc(i.id) + '">' + ((d.fichas[i.id] || []).length ? 'Editar ficha' : 'Montar ficha') + '</button></div></div>';
      }).join('');
    });
    return h;
  }

  function viewMovs(d) {
    if (!d.movs.length) return '<div class="vazio">Nenhum movimento ainda.</div>';
    return '<p class="min" style="margin-bottom:8px">Últimos movimentos.</p>' + d.movs.map(function (m) {
      var pos = m.qtd > 0;
      return '<div class="cartao"><div class="linha"><span class="nome" style="font-size:1.05rem">' + esc(m.insumo) + '</span>' +
        '<span class="preco" style="color:var(--' + (pos ? 'ok' : 'erro') + ')">' + (pos ? '+' : '') + num(m.qtd) + '</span></div>' +
        '<div class="min">' + esc(dbr(m.data)) + ' · ' + esc(MOV[m.tipo] || m.tipo) + (m.valor ? ' · pagou ' + brl(m.valor) : '') + (m.motivo ? ' · ' + esc(m.motivo) : '') + '</div></div>';
    }).join('');
  }

  /* ---------- formulários ---------- */
  function colherInsumo() {
    FORM.nome = val('i-nome'); FORM.un = val('i-un-sel') || FORM.un; FORM.outra = val('i-un-outra');
    FORM.qtd = val('i-qtd'); FORM.pr = val('i-pr'); FORM.preco = val('i-preco'); FORM.emb = val('i-emb');
    var u = document.getElementById('i-emb-u'); FORM.embU = u ? u.options[u.selectedIndex].text : '';
    var q = document.getElementById('i-qtd-u'); FORM.qtdU = q ? q.options[q.selectedIndex].text : '';
    var p = document.getElementById('i-pr-u'); FORM.prU = p ? p.options[p.selectedIndex].text : '';
  }
  function formInsumo(i, manter) {
    if (!manter) FORM = i ? { id: i.id, nome: i.nome, pr: num(i.ponto_reposicao), ativo: i.ativo } : { id: null, un: 'g', nome: '' };
    var base = baseDoForm(), novo = !FORM.id;
    var h = '<h3 style="margin-bottom:8px">' + (novo ? 'Novo insumo' : 'Editar insumo') + '</h3>' +
      campo('Nome do insumo', inp('i-nome', FORM.nome, 'maxlength="60" placeholder="Ex.: Esfoliante"'));
    if (novo) {
      h += campo('Como você mede nas sessões?', '<select id="i-un-sel">' + MEDIDAS.map(function (m) {
        var sel = m[0] === FORM.un ? ' selected' : ''; return '<option value="' + m[0] + '"' + sel + '>' + m[1] + '</option>';
      }).join('') + '</select>' + (FORM.un === 'outra' ? '<input type="text" id="i-un-outra" maxlength="12" placeholder="Ex.: par, kit" value="' + esc(FORM.outra || '') + '" style="margin-top:6px">' : ''),
        'Dica: pó e creme em gramas, líquidos em ml, luvas e máscaras em unidades.');
    } else {
      h += '<p class="min" style="margin-bottom:8px">Medido em <b>' + esc(base) + '</b>.</p>';
    }
    if (novo) h += campoQtd('i-qtd', 'Quanto você tem agora?', base, FORM.qtd, 'Pode digitar em kg ou litro, o sistema converte.', FORM.qtdU);
    h += campoQtd('i-pr', 'Avisar para repor quando chegar a', base, FORM.pr, 'Quando o estoque chegar nesse número, o painel avisa.', FORM.prU);
    h += '<div class="cartao" style="margin:12px 0"><h3 style="margin-bottom:6px;font-size:1.05rem">Quanto custa? (opcional)</h3>' +
      '<p class="min" style="margin-bottom:8px">' + (!novo && FORM.id && insumo(FORM.id).custo_unit !== null ? 'Hoje: ' + dinheiro(insumo(FORM.id).custo_unit) + ' por ' + esc(EXTENSO[base] || base) + '. Só preencha se o preço mudou.' : 'Digite o que você pagou na embalagem. O sistema calcula o custo de cada unidade.') + '</p>' +
      campo('Quanto você pagou na embalagem (R$)', inp('i-preco', FORM.preco, 'inputmode="decimal" placeholder="Ex.: 65"')) +
      campoQtd('i-emb', 'O que veio nessa embalagem?', base, FORM.emb, '', FORM.embU) +
      '<div class="msg info" id="i-prev" style="margin:8px 0 0">Preencha o preço e o que veio para ver o custo.</div></div>';
    if (!novo) h += '<label class="check"><input type="checkbox" id="i-ativo"' + (FORM.ativo ? ' checked' : '') + '><span>Ainda uso este insumo</span></label>';
    h += '<div class="acoes duas"><button type="button" class="btn-discreto" data-m="fechar">Voltar</button><button type="button" class="btn-primario" data-est="insumo-salvar" id="btn-ins">Salvar</button></div>';
    A.abrirModal(h);
    previaCusto();
  }
  function custoCalculado() { // R$ por unidade base, ou null
    var preco = dec(val('i-preco')), emb = lerQtd('i-emb');
    return (preco > 0 && emb > 0) ? preco / emb : null;
  }
  function previaCusto() {
    var el = document.getElementById('i-prev'); if (!el) return;
    var c = custoCalculado(), base = baseDoForm();
    el.textContent = c === null ? 'Preencha o preço e o que veio para ver o custo.' : 'Custo: ' + dinheiro(c) + ' por ' + (EXTENSO[base] || base) + '.';
  }

  function formMov(i, tipo) {
    FORM = { id: i.id, tipo: tipo };
    var titulo = { entrada: 'Comprei mais: ' + i.nome, saida: 'Saiu ou perdi: ' + i.nome, ajuste: 'Contei o estoque: ' + i.nome }[tipo];
    var rot = { entrada: 'Quanto você comprou?', saida: 'Quanto saiu?', ajuste: 'Quanto tem de verdade agora?' }[tipo];
    var dica = tipo === 'ajuste' ? 'O sistema tem ' + qtdBonita(i.qtd_atual, i.unidade) + '. Digite o que você contou.' : tipo === 'saida' ? 'Use para perda ou uso fora das sessões. As sessões já descontam sozinhas.' : '';
    var motivoPh = tipo === 'entrada' ? 'Ex.: loja X' : tipo === 'saida' ? 'Ex.: caiu no chão' : 'Ex.: contagem do mês';
    A.abrirModal('<h3 style="margin-bottom:8px">' + esc(titulo) + '</h3>' +
      campoQtd('mv-qtd', rot, i.unidade, '', dica) +
      (tipo === 'entrada' ? campo('Quanto você pagou (R$) (opcional)', inp('mv-valor', '', 'inputmode="decimal" placeholder="Ex.: 65"'), 'Se preencher, o custo de cada unidade é atualizado sozinho.') : '') +
      campo('Data', '<input type="date" id="mv-data" value="' + esc(A.hojeLocal()) + '">') +
      campo('Observação (opcional)', inp('mv-motivo', '', 'maxlength="80" placeholder="' + motivoPh + '"')) +
      '<div class="acoes duas"><button type="button" class="btn-discreto" data-m="fechar">Voltar</button><button type="button" class="btn-primario" data-est="mov-salvar" id="btn-mov">Registrar</button></div>');
  }

  function colherFicha() {
    FORM.linhas = [];
    document.querySelectorAll('[data-fl]').forEach(function (r) {
      FORM.linhas.push({ insumo_id: r.querySelector('select').value, qtd: r.querySelector('input').value });
    });
  }
  function formFicha(itemId, manter) {
    var d = P.dados.estoque, it = item(itemId);
    if (!manter) FORM = { item_id: itemId, linhas: (d.fichas[itemId] || []).map(function (l) { return { insumo_id: l.insumo_id, qtd: num(l.qtd) }; }) };
    if (!FORM.linhas.length) FORM.linhas.push({ insumo_id: '', qtd: '' });
    var h = '<h3 style="margin-bottom:4px">Ficha técnica</h3><p class="lead" style="margin-bottom:6px">' + esc(it.nome) + '</p>' +
      '<p class="min" style="margin-bottom:10px">Quanto de cada insumo uma sessão gasta (na mesma medida do insumo, ex.: gramas).</p>';
    h += FORM.linhas.map(function (l, n) {
      return '<div data-fl="' + n + '" style="display:grid;grid-template-columns:1fr 90px auto;gap:6px;align-items:end;margin-bottom:8px">' +
        '<label class="campo" style="margin:0"><span>Insumo</span><select>' + '<option value="">Escolha...</option>' +
        d.insumos.filter(function (i) { return i.ativo || i.id === l.insumo_id; }).map(function (i) {
          return '<option value="' + esc(i.id) + '"' + (i.id === l.insumo_id ? ' selected' : '') + '>' + esc(i.nome) + ' (' + esc(i.unidade) + ')</option>';
        }).join('') + '</select></label>' +
        '<label class="campo" style="margin:0"><span>Gasto</span><input type="text" inputmode="decimal" value="' + esc(l.qtd) + '" placeholder="0"></label>' +
        '<button type="button" class="btn-perigo" style="padding:10px 12px" data-est="ficha-rem" data-i="' + n + '" aria-label="Tirar linha">✕</button></div>';
    }).join('');
    h += '<div class="acoes"><button type="button" class="btn-discreto" data-est="ficha-add">+ Adicionar insumo</button></div>';
    h += '<div class="acoes duas"><button type="button" class="btn-discreto" data-m="fechar">Voltar</button><button type="button" class="btn-primario" data-est="ficha-salvar" id="btn-ficha">Salvar ficha</button></div>';
    A.abrirModal(h);
  }

  /* ---------- eventos ---------- */
  var root = document.getElementById('painel');
  root.addEventListener('input', function (ev) { if (/^i-(preco|emb)/.test(ev.target.id)) previaCusto(); });
  root.addEventListener('change', function (ev) {
    var id = ev.target.id;
    if (id === 'i-emb-u') previaCusto();
    if (id === 'i-un-sel' && FORM && !FORM.id) { colherInsumo(); FORM.qtdU = FORM.prU = FORM.embU = ''; formInsumo(null, true); }
  });

  function salvarInsumo() {
    comBotao('btn-ins', 'Salvar', async function () {
      var novo = !FORM.id, ins = novo ? null : insumo(FORM.id);
      var qtd = novo ? lerQtd('i-qtd') : 0, pr = lerQtd('i-pr');
      if (novo && val('i-qtd').trim() && isNaN(qtd)) throw new Error('Digite a quantidade só com números.');
      if (val('i-pr').trim() && isNaN(pr)) throw new Error('Digite o ponto de reposição só com números.');
      var preco = dec(val('i-preco')), temPreco = val('i-preco').trim() !== '', temEmb = val('i-emb').trim() !== '';
      if (temPreco !== temEmb) throw new Error('Para calcular o custo, preencha o preço e o que veio na embalagem (ou deixe os dois em branco).');
      var custo = custoCalculado();
      if (temPreco && custo === null) throw new Error('Confira o preço e a quantidade da embalagem: use só números maiores que zero.');
      if (custo === null) custo = ins && ins.custo_unit !== null ? ins.custo_unit : '';
      await chamar('adm_insumo_salvar', {
        id: FORM.id, nome: val('i-nome'), unidade: baseDoForm(), qtd_atual: novo && !isNaN(qtd) ? String(qtd) : '',
        ponto_reposicao: isNaN(pr) ? '' : String(pr), custo_unit: custo === '' ? '' : String(Math.round(custo * 1000000) / 1000000),
        ativo: FORM.id ? chk('i-ativo') : true
      });
      await recarregar('Insumo salvo!');
    });
  }

  var anterior = EXT.click;
  EXT.click = function (t, ev) {
    var c = t.dataset.est;
    if (!c) return anterior ? anterior(t, ev) : false;
    if (c === 'sub') { E.sub = t.dataset.v; A.desenhar(); return true; }
    if (c === 'insumo-novo') { formInsumo(null, false); return true; }
    if (c === 'insumo-editar') { formInsumo(insumo(t.dataset.id), false); return true; }
    if (c === 'insumo-salvar') { salvarInsumo(); return true; }
    if (c === 'mov') { formMov(insumo(t.dataset.id), t.dataset.t); return true; }
    if (c === 'mov-salvar') {
      comBotao('btn-mov', 'Registrar', async function () {
        var q = lerQtd('mv-qtd');
        if (isNaN(q)) throw new Error('Digite a quantidade só com números.');
        var vl = document.getElementById('mv-valor') ? val('mv-valor').trim() : '';
        if (vl && isNaN(dec(vl))) throw new Error('Digite o valor pago só com números (ex.: 65).');
        var r = await chamar('adm_estoque_mov', { insumo_id: FORM.id, tipo: FORM.tipo, qtd: String(q), data: val('mv-data'), motivo: val('mv-motivo'), valor: vl ? String(dec(vl)) : '' });
        await recarregar(r.alerta ? 'Registrado. Atenção: já está no ponto de repor.' : 'Registrado!');
      });
      return true;
    }
    if (c === 'ficha-editar') { formFicha(t.dataset.id, false); return true; }
    if (c === 'ficha-add') { colherFicha(); FORM.linhas.push({ insumo_id: '', qtd: '' }); formFicha(FORM.item_id, true); return true; }
    if (c === 'ficha-rem') { colherFicha(); FORM.linhas.splice(+t.dataset.i, 1); formFicha(FORM.item_id, true); return true; }
    if (c === 'ficha-salvar') {
      colherFicha();
      comBotao('btn-ficha', 'Salvar ficha', async function () {
        var linhas = FORM.linhas.filter(function (l) { return l.insumo_id || String(l.qtd).trim(); });
        await chamar('adm_ficha_salvar', { item_id: FORM.item_id, linhas: linhas });
        await recarregar('Ficha salva!');
      });
      return true;
    }
    return false;
  };
})();
