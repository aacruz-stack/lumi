// Lumi · painel da dona: "Testes e limpeza" (dentro de Ajustes). Apagar de vez o que foi teste, inclusive da Agenda do Google.
// "Excluir de vez" não é cancelar: apaga o registro e tudo que dependia dele. Para reservas reais, use Cancelar.
(function () {
  'use strict';
  var A = window.LumiAdmin;
  if (!A) return;
  var P = A.P, EXT = A.EXT, chamar = A.chamar;
  var L = { testes: null, reservas: null, orfaos: null, ocupado: '' };

  function dbr(ds) { var p = String(ds || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function rodando(chave, fn) {
    if (L.ocupado) return;
    L.ocupado = chave; A.desenhar();
    Promise.resolve().then(fn).catch(function (e) {
      if (/senha|tentativas/i.test(e.message)) { L.ocupado = ''; return A.telaLogin(e.message); }
      P.erro = e.message;
    }).then(function () { L.ocupado = ''; A.desenhar(); });
  }
  function btn(rotulo, acao, extra, perigo) {
    return '<button type="button" class="' + (perigo ? 'btn-perigo' : 'btn-discreto') + '" data-lp="' + acao + '"' + (extra || '') + (L.ocupado ? ' disabled' : '') + '>' + rotulo + '</button>';
  }
  function lista(titulo, itens) {
    return itens.length ? '<div class="min" style="margin-top:6px"><b>' + titulo + ' (' + itens.length + '):</b><br>' + itens.map(esc).join('<br>') + '</div>' : '';
  }

  function secao() {
    var h = '<div class="cartao" style="margin-top:16px"><h3 style="margin-bottom:6px">Regras do negócio</h3><p class="min">Todas as regras (preços, sinal, validade, remarcação, pagamentos) explicadas em um só lugar: ' +
      '<a href="https://github.com/aacruz-stack/lumi/blob/main/REGRAS.md" target="_blank" rel="noopener">abrir REGRAS.md</a>.</p></div>' +
      '<div class="cartao" style="margin-top:16px"><h3 style="margin-bottom:6px">Testes e limpeza</h3>' +
      '<p class="min">Quando você fizer um teste, dê um nome que <b>comece com TESTE</b> (ex.: "TESTE Maria"). Depois é só apagar daqui, sem sobrar nada no sistema nem na sua Agenda do Google.</p>';

    // 1) apagar todos os testes de uma vez
    h += '<h4 style="margin:14px 0 6px;color:var(--dourado-claro)">Apagar todos os testes</h4>';
    if (!L.testes) h += btn(L.ocupado === 'testes' ? 'Procurando...' : 'Procurar testes', 'testes-buscar');
    else {
      var t = L.testes, total = t.reservas.length + t.vendas.length + t.insumos.length + t.lancamentos.length;
      if (!total) h += '<div class="msg ok">Nenhum teste encontrado. ✨</div>' + btn('Procurar de novo', 'testes-buscar');
      else h += '<div class="msg info">Encontrei isto (nome começando com TESTE):' +
        lista('Reservas', t.reservas.map(function (r) { return r.nome + ' · ' + r.status; })) +
        lista('Vendas do Caixa', t.vendas.map(function (v) { return v.cliente + ' · ' + brl(v.total); })) +
        lista('Insumos', t.insumos.map(function (i) { return i.nome; })) +
        lista('Lançamentos', t.lancamentos.map(function (l) { return l.descricao + ' · ' + brl(l.valor); })) + '</div>' +
        '<div class="acoes duas">' + btn('Procurar de novo', 'testes-buscar') + btn(L.ocupado === 'apagar' ? 'Apagando...' : 'Apagar tudo isso', 'testes-apagar', '', true) + '</div>';
    }

    // 2) reservas, uma a uma
    h += '<h4 style="margin:18px 0 6px;color:var(--dourado-claro)">Reservas (excluir uma por uma)</h4>';
    if (!L.reservas) h += btn(L.ocupado === 'reservas' ? 'Carregando...' : 'Ver reservas recentes', 'reservas-ver');
    else if (!L.reservas.length) h += '<div class="vazio">Nenhuma reserva.</div>';
    else h += L.reservas.map(function (r) {
      return '<div class="cartao" style="padding:10px 12px"><div class="linha" style="display:flex;justify-content:space-between;gap:10px"><span><b>' + esc(r.nome || 'Cliente') + '</b> · ' + esc(r.item_nome) + '</span><span>' + brl(r.total) + '</span></div>' +
        '<div class="min">' + esc(r.status) + ' · ' + esc(r.pagamento) + (r.primeira_data ? ' · ' + esc(dbr(r.primeira_data)) : '') + ' · código ' + esc(r.codigo) + '</div>' +
        (r.teste ? '<div><span class="chip ouro">Teste</span></div>' : '') +
        (r.do_caixa ? '<div class="min">Veio de uma venda do Caixa: apague pela aba Caixa → Vendas do dia.</div>'
          : '<div class="acoes">' + btn('Excluir de vez', 'reserva-excluir', ' data-cod="' + esc(r.codigo) + '" data-nome="' + esc(r.nome || 'Cliente') + '"', true) + '</div>') + '</div>';
    }).join('');

    // 3) eventos sobrando na agenda do google
    h += '<h4 style="margin:18px 0 6px;color:var(--dourado-claro)">Agenda do Google</h4>' +
      '<p class="min" style="margin-bottom:6px">Procura eventos "Lumi · ..." que o sistema não conhece mais (por exemplo, de testes antigos) e apaga só se você mandar.</p>';
    if (!L.orfaos) h += btn(L.ocupado === 'orfaos' ? 'Procurando...' : 'Procurar eventos sobrando', 'orfaos-buscar');
    else if (!L.orfaos.length) h += '<div class="msg ok">Nenhum evento sobrando na Agenda. ✨</div>' + btn('Procurar de novo', 'orfaos-buscar');
    else h += '<div class="msg info">Estes eventos estão na sua Agenda do Google, mas não pertencem a nenhuma reserva:' +
      '<div class="min" style="margin-top:6px">' + L.orfaos.map(function (e) { return esc(e.quando) + ' · ' + esc(e.titulo); }).join('<br>') + '</div></div>' +
      '<div class="acoes duas">' + btn('Procurar de novo', 'orfaos-buscar') + btn(L.ocupado === 'orfaos-apagar' ? 'Apagando...' : 'Apagar estes eventos', 'orfaos-apagar', '', true) + '</div>';
    return h + '</div>';
  }

  // acrescenta a seção no fim da aba Ajustes
  var original = EXT.views.ajustes;
  if (typeof original !== 'function') return;
  EXT.views.ajustes = function () { return original() + secao(); };

  var anterior = EXT.click;
  EXT.click = function (t, ev) {
    var c = t.dataset.lp;
    if (!c) return anterior ? anterior(t, ev) : false;
    if (c === 'testes-buscar') { rodando('testes', async function () { L.testes = await chamar('adm_testes_listar'); }); return true; }
    if (c === 'testes-apagar') {
      var q = L.testes; if (!q) return true;
      A.modalConfirmar('Apagar todos os testes?', 'Vai apagar de vez ' + q.reservas.length + ' reserva(s), ' + q.vendas.length + ' venda(s) do Caixa, ' + q.insumos.length + ' insumo(s) e ' + q.lancamentos.length +
        ' lançamento(s), com os eventos da Agenda do Google, o financeiro e o estoque ligados a eles. Não dá para desfazer.', 'Apagar tudo', true, async function () {
        P.modal = null; L.ocupado = 'apagar'; A.desenhar();
        try { var r = await chamar('adm_testes_apagar'); L.testes = null; L.reservas = null; toast('Apagado: ' + r.reservas + ' reserva(s), ' + r.vendas + ' venda(s), ' + r.insumos + ' insumo(s), ' + r.lancamentos + ' lançamento(s).'); }
        catch (e) { P.erro = e.message; }
        L.ocupado = ''; A.desenhar();
      });
      return true;
    }
    if (c === 'reservas-ver') { rodando('reservas', async function () { L.reservas = (await chamar('adm_reservas_lista')).reservas; }); return true; }
    if (c === 'reserva-excluir') {
      var cod = t.dataset.cod, nome = t.dataset.nome;
      A.modalConfirmar('Excluir de vez?', 'Apaga a reserva de ' + nome + ' e tudo que depende dela: eventos da Agenda do Google, o que foi lançado no Financeiro e o material baixado do estoque (volta ao estoque). Não dá para desfazer. Se for uma reserva real, use "Cancelar reserva" em vez disto.', 'Excluir de vez', true, async function () {
        P.modal = null; L.ocupado = 'excluir'; A.desenhar();
        try {
          var r = await chamar('adm_reserva_excluir', { codigo: cod });
          L.reservas = (await chamar('adm_reservas_lista')).reservas; L.testes = null;
          toast('Reserva excluída' + (r.entradas_apagadas > 0 ? ' (saíram ' + brl(r.entradas_apagadas) + ' do Financeiro)' : ''));
        } catch (e) { P.erro = e.message; }
        L.ocupado = ''; A.desenhar();
      });
      return true;
    }
    if (c === 'orfaos-buscar') { rodando('orfaos', async function () { L.orfaos = (await chamar('adm_agenda_orfaos', {})).eventos; }); return true; }
    if (c === 'orfaos-apagar') {
      A.modalConfirmar('Apagar estes eventos da Agenda?', 'Os eventos listados saem da sua Agenda do Google. Eles não pertencem a nenhuma reserva do sistema. Não dá para desfazer.', 'Apagar eventos', true, async function () {
        P.modal = null; L.ocupado = 'orfaos-apagar'; A.desenhar();
        try { var r = await chamar('adm_agenda_orfaos', { apagar: true }); L.orfaos = null; toast(r.apagados + ' evento(s) apagado(s) da Agenda'); }
        catch (e) { P.erro = e.message; }
        L.ocupado = ''; A.desenhar();
      });
      return true;
    }
    return false;
  };
})();
