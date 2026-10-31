// Lumi · painel da dona: aba Estoque (insumos, fichas técnicas e movimentos). Usa os ganchos de admin.js.
(function () {
  'use strict';
  var A = window.LumiAdmin;
  if (!A) return;
  var P = A.P, EXT = A.EXT, chamar = A.chamar;
  var E = { sub: 'insumos' }, FORM = null;
  var SUBS = [['insumos', 'Insumos'], ['fichas', 'Fichas técnicas'], ['movs', 'Movimentos']];
  var TIPOS = { sessao: 'Sessões', pacote: 'Pacotes', adicional: 'Adicionais' };
  var MOV = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Contagem', baixa_sessao: 'Sessão realizada', estorno_sessao: 'Sessão desfeita' };

  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function chk(id) { var e = document.getElementById(id); return !!(e && e.checked); }
  function num(v) { return String(Math.round(Number(v) * 1000) / 1000).replace('.', ','); }
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
        '<span class="preco">' + num(i.qtd_atual) + ' ' + esc(i.unidade) + '</span></div>' +
        '<div class="min">Repor quando chegar a ' + num(i.ponto_reposicao) + ' ' + esc(i.unidade) +
        (i.custo_unit !== null ? ' · custo ' + brl(i.custo_unit) + ' por ' + esc(i.unidade) : '') + '</div>' +
        '<div>' + (i.alerta ? '<span class="chip erro">Repor</span>' : '<span class="chip ok">Em dia</span>') + (i.ativo ? '' : '<span class="chip">Inativo</span>') + '</div>' +
        '<div class="acoes duas"><button type="button" class="btn-primario" data-est="mov" data-t="entrada" data-id="' + esc(i.id) + '">Entrada (compra)</button>' +
        '<button type="button" class="btn-discreto" data-est="mov" data-t="saida" data-id="' + esc(i.id) + '">Saída</button></div>' +
        '<div class="acoes duas"><button type="button" class="btn-discreto" data-est="mov" data-t="ajuste" data-id="' + esc(i.id) + '">Contar estoque</button>' +
        '<button type="button" class="btn-discreto" data-est="insumo-editar" data-id="' + esc(i.id) + '">Editar</button></div></div>';
    }).join('');
  }

  function fichaTexto(d, itemId) {
    var l = d.fichas[itemId] || [];
    if (!l.length) return '<span class="min">Sem ficha técnica: não dá baixa no estoque.</span>';
    return l.map(function (x) { var i = insumo(x.insumo_id); return '<div class="min">• ' + esc(i ? i.nome : x.insumo_id) + ': ' + num(x.qtd) + ' ' + esc(i ? i.unidade : '') + '</div>'; }).join('');
  }
  function viewFichas(d) {
    var h = '<p class="min" style="margin-bottom:10px">Quanto de cada insumo uma sessão gasta. A baixa acontece quando você marca a sessão como realizada. Nos adicionais, a baixa acontece junto com a 1ª sessão da reserva.</p>';
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
        '<div class="min">' + esc(dbr(m.data)) + ' · ' + esc(MOV[m.tipo] || m.tipo) + (m.motivo ? ' · ' + esc(m.motivo) : '') + '</div></div>';
    }).join('');
  }

  /* ---------- formulários ---------- */
  function formInsumo(i) {
    FORM = { id: i ? i.id : null };
    A.abrirModal('<h3 style="margin-bottom:8px">' + (i ? 'Editar insumo' : 'Novo insumo') + '</h3>' +
      campo('Nome', inp('i-nome', i ? i.nome : '', 'maxlength="60" placeholder="Ex.: Luva descartável"')) +
      campo('Unidade', inp('i-un', i ? i.unidade : '', 'maxlength="12" placeholder="un, ml, g..."')) +
      (i ? '' : campo('Quantidade atual', inp('i-qtd', '', 'inputmode="decimal" placeholder="0"'), 'Quanto você tem agora.')) +
      campo('Ponto de reposição', inp('i-pr', i ? num(i.ponto_reposicao) : '', 'inputmode="decimal" placeholder="0"'), 'Quando o estoque chegar nesse número, o painel avisa para repor.') +
      campo('Custo por unidade em R$ (opcional)', inp('i-custo', i && i.custo_unit !== null ? num(i.custo_unit) : '', 'inputmode="decimal" placeholder="0,00"'), 'Vai ser usado no financeiro, na próxima etapa.') +
      (i ? '<label class="check"><input type="checkbox" id="i-ativo"' + (i.ativo ? ' checked' : '') + '><span>Em uso</span></label>' : '') +
      '<div class="acoes duas"><button type="button" class="btn-discreto" data-m="fechar">Voltar</button><button type="button" class="btn-primario" data-est="insumo-salvar" id="btn-ins">Salvar</button></div>');
  }

  function formMov(i, tipo) {
    FORM = { id: i.id, tipo: tipo };
    var titulo = { entrada: 'Entrada de ' + i.nome, saida: 'Saída de ' + i.nome, ajuste: 'Contar ' + i.nome }[tipo];
    var rotQtd = tipo === 'ajuste' ? 'Quantidade contada (' + i.unidade + ')' : 'Quantidade (' + i.unidade + ')';
    var dica = tipo === 'ajuste' ? 'Hoje o sistema tem ' + num(i.qtd_atual) + ' ' + i.unidade + '. Digite o que você contou de verdade.' : '';
    var motivoPh = tipo === 'entrada' ? 'Ex.: compra na loja X' : tipo === 'saida' ? 'Ex.: perda, uso fora da sessão' : 'Ex.: contagem do mês';
    A.abrirModal('<h3 style="margin-bottom:8px">' + esc(titulo) + '</h3>' +
      campo(rotQtd, inp('mv-qtd', '', 'inputmode="decimal" placeholder="0"'), dica) +
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
    var h = '<h3 style="margin-bottom:4px">Ficha técnica</h3><p class="lead" style="margin-bottom:10px">' + esc(it.nome) + '</p>';
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

  /* ---------- cliques ---------- */
  var anterior = EXT.click;
  EXT.click = function (t, ev) {
    var c = t.dataset.est;
    if (!c) return anterior ? anterior(t, ev) : false;
    if (c === 'sub') { E.sub = t.dataset.v; A.desenhar(); return true; }
    if (c === 'insumo-novo') { formInsumo(null); return true; }
    if (c === 'insumo-editar') { formInsumo(insumo(t.dataset.id)); return true; }
    if (c === 'insumo-salvar') {
      comBotao('btn-ins', 'Salvar', async function () {
        await chamar('adm_insumo_salvar', { id: FORM.id, nome: val('i-nome'), unidade: val('i-un'), qtd_atual: val('i-qtd'), ponto_reposicao: val('i-pr'), custo_unit: val('i-custo'), ativo: FORM.id ? chk('i-ativo') : true });
        await recarregar('Insumo salvo!');
      });
      return true;
    }
    if (c === 'mov') { formMov(insumo(t.dataset.id), t.dataset.t); return true; }
    if (c === 'mov-salvar') {
      comBotao('btn-mov', 'Registrar', async function () {
        var r = await chamar('adm_estoque_mov', { insumo_id: FORM.id, tipo: FORM.tipo, qtd: val('mv-qtd'), data: val('mv-data'), motivo: val('mv-motivo') });
        await recarregar(r.alerta ? 'Registrado. Atenção: já está no ponto de reposição.' : 'Registrado!');
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
