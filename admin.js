// Lumi · painel da dona. A senha so vai no corpo do POST; toda checagem acontece no servidor.
(function () {
  'use strict';
  var root = document.getElementById('painel');
  var P = { senha: '', aba: 'pendentes', dados: {}, carregando: false, erro: '', agFiltro: 'hoje', agBusca: '', pacFiltro: 'abertos', modal: null };
  var ABAS = [['pendentes', 'Pendentes'], ['agenda', 'Agenda'], ['pacotes', 'Pacotes'], ['bloqueios', 'Bloqueios'], ['catalogo', 'Catálogo'], ['ajustes', 'Ajustes']];
  var EXT = { loaders: {}, views: {}, click: null, submit: null };

  function chamar(action, body) { return Api.post(action, Object.assign({ senha: P.senha }, body || {})); }
  function hojeLocal() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fone(f) { f = String(f || ''); var d = f.replace(/^55/, ''); return d.length === 11 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7) : d.length === 10 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6) : f; }
  function zap(f) { return 'https://wa.me/' + String(f).replace(/\D/g, ''); }
  function dh(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }

  /* ---------- login ---------- */
  function telaLogin(msg) {
    root.innerHTML = '<div class="tela" style="margin-top:20px"><h2>Entrar</h2><p class="lead">Digite a senha do painel.</p>' +
      (msg ? '<div class="msg erro" role="alert">' + esc(msg) + '</div>' : '') +
      '<form id="f-login"><label class="campo"><span>Senha</span><input type="password" id="senha" autocomplete="current-password" required></label>' +
      '<div class="acoes"><button class="btn-primario" type="submit" id="btn-login">Entrar</button></div></form></div>';
    document.getElementById('senha').focus();
    document.getElementById('f-login').onsubmit = async function (e) {
      e.preventDefault();
      var b = document.getElementById('btn-login'); b.disabled = true; b.textContent = 'Entrando...';
      P.senha = document.getElementById('senha').value;
      try { await chamar('adm_ping'); try { sessionStorage.setItem('lumi_adm', P.senha); } catch (x) {} abrir('pendentes'); }
      catch (err) { P.senha = ''; telaLogin(err.message); }
    };
  }
  function sair() { P.senha = ''; try { sessionStorage.removeItem('lumi_adm'); } catch (x) {} telaLogin(); }

  /* ---------- moldura ---------- */
  function moldura(corpo) {
    var pend = (P.dados.pendentes && P.dados.pendentes.confirmacao) ? P.dados.pendentes.confirmacao.length : 0;
    root.innerHTML = '<div class="nav-painel" role="tablist">' + ABAS.map(function (a) {
      return '<button type="button" data-aba="' + a[0] + '" class="' + (P.aba === a[0] ? 'on' : '') + '">' + a[1] + (a[0] === 'pendentes' && pend ? '<span class="badge">' + pend + '</span>' : '') + '</button>';
    }).join('') + '<button type="button" data-sair="1" style="flex:0 0 auto">Sair</button></div>' +
      (P.erro ? '<div class="msg erro" role="alert">' + esc(P.erro) + '</div>' : '') + corpo + (P.modal ? P.modal : '');
  }
  function carregandoTela() { moldura('<div class="carregando"><div class="spin"></div>Carregando...</div>'); }

  async function abrir(aba) {
    P.aba = aba; P.erro = ''; carregandoTela();
    try {
      if (aba === 'pendentes') P.dados.pendentes = await chamar('adm_pendentes');
      else if (aba === 'agenda') P.dados.agenda = await chamar('adm_agenda', agParams());
      else if (aba === 'pacotes') P.dados.pacotes = await chamar('adm_pacotes', { filtro: P.pacFiltro });
      else if (aba === 'bloqueios') P.dados.bloqueios = await chamar('adm_bloqueios');
      else if (EXT.loaders[aba]) await EXT.loaders[aba]();
      if (aba !== 'pendentes' && !P.dados.pendentes) { try { P.dados.pendentes = await chamar('adm_pendentes'); } catch (e) {} }
    } catch (e) {
      if (/senha|tentativas/i.test(e.message)) return telaLogin(e.message);
      P.erro = e.message;
    }
    desenhar();
  }
  function desenhar() {
    var f = { pendentes: viewPendentes, agenda: viewAgenda, pacotes: viewPacotes, bloqueios: viewBloqueios }[P.aba] || EXT.views[P.aba];
    moldura(f());
  }

  /* ---------- pendentes ---------- */
  function sessoesLista(r) {
    return '<ul class="resumo-sessoes">' + r.sessoes.filter(function (s) { return s.status !== 'Cancelada' && s.status !== 'Expirada'; }).map(function (s) {
      return '<li>✦ ' + (r.sessoes.length > 1 ? 'Sessão ' + s.n + ': ' : '') + esc(dataBR(s.data) + ' às ' + s.inicio) + ' <span class="min">(' + s.duracao + ' min)</span></li>';
    }).join('') + '</ul>';
  }
  function cardReserva(r, botoes) {
    return '<div class="cartao' + (r.vip ? ' vip' : '') + '"><div class="card-linha"><span class="nome">' + esc(r.nome) + (r.nome2 ? ' e ' + esc(r.nome2) : '') + '</span><span class="preco">' + brl(r.sinal) + '</span></div>' +
      '<div>' + esc(r.item_nome) + (r.vip ? ' <span class="chip ouro">VIP</span>' : '') + '</div>' +
      '<div class="min">Total ' + brl(r.total) + ' · Sinal ' + brl(r.sinal) + ' · Restante ' + brl(r.restante) + '</div>' +
      '<div class="min">' + esc(fone(r.whatsapp)) + ' · código ' + esc(r.codigo) + (r.pix_clicado_em ? ' · avisou às ' + esc(dh(r.pix_clicado_em)) : '') + '</div>' +
      sessoesLista(r) + '<div class="acoes duas">' + botoes + '</div></div>';
  }
  function viewPendentes() {
    var d = P.dados.pendentes || { confirmacao: [], aguardando_pix: [] };
    var h = '<h2 style="margin-bottom:10px">Pix para confirmar</h2>';
    if (!d.confirmacao.length) h += '<div class="vazio">Nenhum Pix esperando confirmação. ✨</div>';
    h += d.confirmacao.map(function (r) {
      return cardReserva(r, '<button type="button" class="btn-primario" data-act="confirmar" data-cod="' + esc(r.codigo) + '">Confirmar Pix</button>' +
        '<button type="button" class="btn-perigo" data-act="cancelar" data-cod="' + esc(r.codigo) + '">Cancelar</button>');
    }).join('');
    if (d.aguardando_pix.length) {
      h += '<h3 style="margin:24px 0 8px;color:var(--dourado-claro)">Ainda não avisaram o Pix</h3><p class="min">Expiram sozinhas se não avisarem dentro do prazo.</p>';
      h += d.aguardando_pix.map(function (r) {
        return cardReserva(r, '<button type="button" class="btn-discreto" data-act="confirmar" data-cod="' + esc(r.codigo) + '">Confirmar mesmo assim</button>' +
          '<button type="button" class="btn-perigo" data-act="cancelar" data-cod="' + esc(r.codigo) + '">Cancelar</button>');
      }).join('');
    }
    return h;
  }

  /* ---------- agenda ---------- */
  function agParams() {
    var h = hojeLocal();
    if (P.agBusca.trim()) return { busca: P.agBusca.trim() };
    if (P.agFiltro === 'hoje') return { de: h, ate: h };
    if (P.agFiltro === 'amanha') return { de: addDias(h, 1), ate: addDias(h, 1) };
    if (P.agFiltro === '7') return { de: h, ate: addDias(h, 7) };
    return { de: h, ate: addDias(h, 30) };
  }
  function viewAgenda() {
    var d = P.dados.agenda || { itens: [] }, h = '<div class="filtros">' + [['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['7', 'Próximos 7 dias'], ['30', '30 dias']].map(function (f) {
      return '<button type="button" data-ag="' + f[0] + '" class="' + (P.agFiltro === f[0] && !P.agBusca ? 'on' : '') + '">' + f[1] + '</button>';
    }).join('') + '</div>' +
      '<form id="f-busca" style="display:flex;gap:8px;margin-bottom:8px"><input type="search" id="busca" placeholder="Buscar por nome ou WhatsApp" value="' + esc(P.agBusca) + '" aria-label="Buscar">' +
      '<button class="btn-discreto btn-mini" type="submit">Buscar</button></form>';
    if (!d.itens.length) return h + '<div class="vazio">Nenhuma sessão ' + (P.agBusca ? 'encontrada.' : 'neste período.') + '</div>';
    var dia = '';
    d.itens.forEach(function (s) {
      if (s.data !== dia) { dia = s.data; h += '<div class="dia-titulo">' + esc(dataBR(s.data)) + (s.data === d.hoje ? ' · hoje' : '') + '</div>'; }
      var pend = s.status_reserva !== 'Confirmado';
      h += '<div class="cartao' + (s.vip ? ' vip' : '') + '"><div class="card-linha"><span class="hora">' + esc(s.inicio) + '–' + esc(s.fim) + '</span>' +
        '<span>' + (pend ? '<span class="chip erro">' + esc(s.status_reserva) + '</span>' : '<span class="chip ok">Confirmado</span>') + (s.status_sessao === 'Realizada' ? '<span class="chip">Realizada</span>' : '') + (s.vip ? '<span class="chip ouro">VIP</span>' : '') + '</span></div>' +
        '<div><b>' + esc(s.nome) + '</b> · ' + esc(s.item_nome) + (s.total_sessoes > 1 ? ' · sessão ' + s.n + ' de ' + s.total_sessoes : '') + '</div>' +
        '<div class="min"><a href="' + zap(s.whatsapp) + '" target="_blank" rel="noopener">' + esc(fone(s.whatsapp)) + '</a> · reagendamentos usados: ' + s.reag_usados + ' de ' + s.reag_max + '</div>' +
        (s.status_sessao === 'Agendada' ? '<div class="acoes"><button type="button" class="btn-discreto" data-act="remarcar" data-cod="' + esc(s.codigo) + '" data-n="' + s.n + '" data-data="' + esc(s.data) + '" data-hora="' + esc(s.inicio) + '" data-nome="' + esc(s.nome) + '" data-uso="' + s.reag_usados + '" data-max="' + s.reag_max + '">Remarcar</button></div>' : '') + '</div>';
    });
    return h;
  }

  /* ---------- pacotes ---------- */
  function viewPacotes() {
    var d = P.dados.pacotes || { reservas: [] };
    var h = '<div class="filtros"><button type="button" data-pf="abertos" class="' + (P.pacFiltro === 'abertos' ? 'on' : '') + '">Em aberto</button><button type="button" data-pf="todos" class="' + (P.pacFiltro === 'todos' ? 'on' : '') + '">Todos</button></div>';
    if (!d.reservas.length) return h + '<div class="vazio">Nada por aqui.</div>';
    return h + d.reservas.map(function (r) {
      var pct = r.total_sessoes ? Math.round(r.feitas / r.total_sessoes * 100) : 0;
      var prox = r.sessoes.filter(function (s) { return s.status === 'Agendada'; });
      var vencendo = r.restantes > 0 && difDias(d.hoje, r.validade_ate) <= 5;
      return '<div class="cartao' + (r.vip ? ' vip' : '') + '"><div class="card-linha"><span class="nome">' + esc(r.nome) + (r.nome2 ? ' e ' + esc(r.nome2) : '') + '</span>' + (r.vip ? '<span class="chip ouro">Mina VIP</span>' : '<span class="chip">' + esc(r.item_nome) + '</span>') + '</div>' +
        '<div class="min">' + esc(fone(r.whatsapp)) + '</div><div class="barra"><i style="width:' + pct + '%"></i></div>' +
        '<div>Sessões: <b>' + r.feitas + '</b> feitas · <b>' + r.restantes + '</b> restantes</div>' +
        '<div class="min">Validade até ' + esc(dataBR(r.validade_ate)) + (vencendo ? ' <span class="chip erro">vencendo</span>' : '') + '</div>' +
        '<div style="margin-top:6px">A receber: <b style="color:var(--dourado-claro)">' + brl(r.a_receber) + '</b> ' + (r.restante_pago ? '<span class="chip ok">restante pago</span>' : '') + '</div>' +
        '<div class="acoes">' + prox.map(function (s) {
          return '<button type="button" class="btn-discreto" data-act="realizada" data-cod="' + esc(r.codigo) + '" data-n="' + s.n + '">Marcar sessão ' + (r.sessoes.length > 1 ? s.n + ' ' : '') + 'como realizada <span class="min">(' + esc(dataBR(s.data)) + ')</span></button>';
        }).join('') +
        (r.restante_pago ? '<button type="button" class="btn-discreto" data-act="restante" data-undo="1" data-cod="' + esc(r.codigo) + '">Desfazer “restante pago”</button>'
          : '<button type="button" class="btn-primario" data-act="restante" data-cod="' + esc(r.codigo) + '">Marcar restante como pago</button>') + '</div></div>';
    }).join('');
  }

  /* ---------- bloqueios ---------- */
  function viewBloqueios() {
    var d = P.dados.bloqueios || { bloqueios: [] };
    var h = '<div class="cartao"><h3 style="margin-bottom:10px">Bloquear dia ou horário</h3><form id="f-bloq">' +
      '<label class="campo"><span>Data</span><input type="date" id="b-data" min="' + hojeLocal() + '" required></label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="campo"><span>Das (opcional)</span><input type="time" id="b-ini"></label>' +
      '<label class="campo"><span>Até (opcional)</span><input type="time" id="b-fim"></label></div>' +
      '<p class="min" style="margin-top:-6px">Deixe os horários vazios para bloquear o dia inteiro.</p>' +
      '<label class="campo"><span>Motivo</span><input type="text" id="b-motivo" maxlength="80" placeholder="Folga, imprevisto..."></label>' +
      '<div class="acoes"><button type="submit" class="btn-primario">Bloquear</button></div></form></div>';
    h += '<h3 style="margin:18px 0 8px">Bloqueios futuros</h3>';
    if (!d.bloqueios.length) return h + '<div class="vazio">Nenhum bloqueio.</div>';
    return h + d.bloqueios.map(function (b) {
      return '<div class="cartao"><div class="card-linha"><span><b>' + esc(dataBR(b.data)) + '</b> · ' + (b.inicio ? esc(b.inicio) + '–' + esc(b.fim) : 'dia inteiro') + '</span>' +
        '<button type="button" class="btn-perigo btn-mini" data-act="desbloquear" data-id="' + esc(b.id) + '">Remover</button></div>' + (b.motivo ? '<div class="min">' + esc(b.motivo) + '</div>' : '') + '</div>';
    }).join('');
  }

  /* ---------- modais ---------- */
  function abrirModal(html) { P.modal = '<div class="fundo" data-fundo="1"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>'; desenhar(); }
  function fecharModal() { P.modal = null; desenhar(); }
  function modalConfirmar(titulo, texto, textoBtn, perigo, acao) {
    P.pendenteAcao = acao;
    abrirModal('<h3 style="margin-bottom:8px">' + esc(titulo) + '</h3><p class="lead">' + esc(texto) + '</p><div class="acoes duas"><button type="button" class="btn-discreto" data-m="fechar">Voltar</button>' +
      '<button type="button" class="' + (perigo ? 'btn-perigo' : 'btn-primario') + '" data-m="ok" id="m-ok">' + esc(textoBtn) + '</button></div>');
  }
  function modalAviso(titulo, linhas, waUrl) {
    abrirModal('<h3 style="margin-bottom:8px">' + esc(titulo) + '</h3>' + linhas.map(function (l) { return '<div class="msg ' + l[0] + '">' + esc(l[1]) + '</div>'; }).join('') +
      '<div class="acoes">' + (waUrl ? '<a class="btn-primario" target="_blank" rel="noopener" href="' + esc(waUrl) + '">Avisar no WhatsApp</a>' : '') + '<button type="button" class="btn-discreto" data-m="fechar">Fechar</button></div>');
  }

  async function executar(fn, okMsg) {
    var b = document.getElementById('m-ok'); if (b) { b.disabled = true; b.textContent = 'Aguarde...'; }
    try { var r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) {
      if (/senha|tentativas/i.test(e.message)) { P.modal = null; return telaLogin(e.message); }
      P.modal = null; P.erro = e.message; desenhar(); window.scrollTo({ top: 0 });
    }
  }

  async function agir(a, ds) {
    if (a === 'confirmar') {
      return modalConfirmar('Confirmar o Pix?', 'Vai criar os eventos na Agenda Google e enviar o e-mail de confirmação para a cliente.', 'Confirmar Pix', false, async function () {
        var r = await executar(function () { return chamar('adm_confirmar', { codigo: ds.cod }); });
        if (!r) return;
        P.dados.pendentes = await chamar('adm_pendentes');
        var linhas = [['ok', 'Reserva confirmada!'], [r.email_enviado ? 'ok' : 'erro', r.email_enviado ? 'E-mail de confirmação enviado.' : 'Não consegui enviar o e-mail (cota do dia?). Avise pelo WhatsApp.']];
        if (r.aviso_agenda) linhas.push(['erro', r.aviso_agenda]);
        modalAviso('Confirmado ✨', linhas, r.wa_url);
      });
    }
    if (a === 'cancelar') {
      return modalConfirmar('Cancelar reserva?', 'Os horários serão liberados e os eventos da Agenda removidos.', 'Cancelar reserva', true, async function () {
        var r = await executar(function () { return chamar('adm_cancelar', { codigo: ds.cod }); }, 'Reserva cancelada');
        if (r) { P.modal = null; abrir(P.aba); }
      });
    }
    if (a === 'realizada') { var r1 = await executar(function () { return chamar('adm_sessao_realizada', { codigo: ds.cod, n: +ds.n }); }, 'Sessão marcada como realizada'); if (r1) abrir('pacotes'); return; }
    if (a === 'restante') { var r2 = await executar(function () { return chamar('adm_restante_pago', { codigo: ds.cod, desfazer: !!ds.undo }); }, ds.undo ? 'Desfeito' : 'Restante marcado como pago'); if (r2) abrir('pacotes'); return; }
    if (a === 'desbloquear') { var r3 = await executar(function () { return chamar('adm_desbloquear', { id: ds.id }); }, 'Bloqueio removido'); if (r3) abrir('bloqueios'); return; }
    if (a === 'remarcar') return abrirRemarcar(ds);
  }

  /* ---------- remarcar ---------- */
  var RM = null;
  function abrirRemarcar(ds) {
    RM = { cod: ds.cod, n: +ds.n, nome: ds.nome, uso: +ds.uso, max: +ds.max, data: '', hora: '', horas: [], aviso: '', carregando: false };
    modalRemarcar();
  }
  function modalRemarcar() {
    var extra = RM.uso >= RM.max ? '<div class="msg info">Esta cliente já usou ' + RM.uso + ' de ' + RM.max + ' reagendamento(s). Você pode autorizar um encaixe extra.</div>' : '';
    abrirModal('<h3 style="margin-bottom:4px">Remarcar · ' + esc(RM.nome) + '</h3><p class="min">Reagendamentos usados: ' + RM.uso + ' de ' + RM.max + '</p>' + extra +
      '<label class="campo"><span>Nova data</span><input type="date" id="rm-data" min="' + hojeLocal() + '" value="' + esc(RM.data) + '"></label>' +
      (RM.carregando ? '<div class="carregando"><div class="spin"></div>Buscando horários livres...</div>' : '') +
      (RM.aviso ? '<div class="msg erro">' + esc(RM.aviso) + '</div>' : '') +
      (RM.data && !RM.carregando && !RM.aviso ? (RM.horas.length ? '<div class="horas">' + RM.horas.map(function (h) { return '<button type="button" data-rh="' + h + '" class="' + (RM.hora === h ? 'sel' : '') + '">' + h + '</button>'; }).join('') + '</div>' : '<div class="msg info">Sem horários livres neste dia.</div>') : '') +
      '<div class="acoes duas"><button type="button" class="btn-discreto" data-m="fechar">Voltar</button><button type="button" class="btn-primario" data-m="salvar-rm"' + (RM.hora ? '' : ' disabled') + '>Salvar</button></div>');
    var inp = document.getElementById('rm-data');
    if (inp) inp.onchange = async function () {
      RM.data = inp.value; RM.hora = ''; RM.aviso = ''; RM.horas = []; if (!RM.data) return modalRemarcar();
      RM.carregando = true; modalRemarcar();
      try { var r = await chamar('adm_livres', { codigo: RM.cod, n: RM.n, data: RM.data }); RM.horas = r.horarios; RM.aviso = r.aviso; }
      catch (e) { RM.aviso = e.message; }
      RM.carregando = false; modalRemarcar();
    };
  }
  async function salvarRemarcar() {
    var btn = document.querySelector('[data-m="salvar-rm"]'); if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
    try {
      var r = await chamar('adm_remarcar', { codigo: RM.cod, n: RM.n, data: RM.data, hora: RM.hora });
      P.dados.agenda = await chamar('adm_agenda', agParams());
      modalAviso('Remarcado ✨', [['ok', 'Novo horário: ' + dataBR(RM.data) + ' às ' + RM.hora + '. Reagendamentos usados: ' + r.reserva.reag_usados + ' de ' + r.reserva.reag_max + '.'],
        [r.email_enviado ? 'ok' : 'erro', r.email_enviado ? 'E-mail enviado para a cliente.' : 'Não consegui enviar o e-mail. Avise pelo WhatsApp.']], r.wa_url);
    } catch (e) { RM.aviso = e.message; if (/senha|tentativas/i.test(e.message)) return telaLogin(e.message); modalRemarcar(); }
  }

  /* ---------- eventos ---------- */
  root.addEventListener('click', function (ev) {
    var t = ev.target.closest('button,[data-fundo]'); if (!t) return;
    if (EXT.click && EXT.click(t, ev)) return;
    if (t.dataset.fundo && ev.target === t) return fecharModal();
    if (t.dataset.aba) return abrir(t.dataset.aba);
    if (t.dataset.sair) return sair();
    if (t.dataset.m === 'fechar') { if (P.aba === 'pendentes' || P.aba === 'agenda') { P.modal = null; return abrir(P.aba); } return fecharModal(); }
    if (t.dataset.m === 'ok') { var f = P.pendenteAcao; return f && f(); }
    if (t.dataset.m === 'salvar-rm') return salvarRemarcar();
    if (t.dataset.rh) { RM.hora = t.dataset.rh; return modalRemarcar(); }
    if (t.dataset.ag) { P.agFiltro = t.dataset.ag; P.agBusca = ''; return abrir('agenda'); }
    if (t.dataset.pf) { P.pacFiltro = t.dataset.pf; return abrir('pacotes'); }
    if (t.dataset.act) return agir(t.dataset.act, t.dataset);
  });
  root.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (EXT.submit && await EXT.submit(ev)) return;
    if (ev.target.id === 'f-busca') { P.agBusca = document.getElementById('busca').value; return abrir('agenda'); }
    if (ev.target.id === 'f-bloq') {
      var body = { data: document.getElementById('b-data').value, inicio: document.getElementById('b-ini').value, fim: document.getElementById('b-fim').value, motivo: document.getElementById('b-motivo').value };
      try {
        var r = await chamar('adm_bloquear', body);
        await abrir('bloqueios');
        toast(r.conflitos ? 'Bloqueado. Atenção: ' + r.conflitos + ' sessão(ões) já marcada(s) nesse horário!' : 'Bloqueado!');
      } catch (e) { P.erro = e.message; desenhar(); window.scrollTo({ top: 0 }); }
    }
  });

  window.LumiAdmin = { P: P, EXT: EXT, chamar: chamar, abrirModal: abrirModal, fecharModal: fecharModal, desenhar: desenhar, abrir: abrir, modalConfirmar: modalConfirmar,
    hojeLocal: hojeLocal, telaLogin: telaLogin };

  /* ---------- inicio ---------- */
  var salva = null; try { salva = sessionStorage.getItem('lumi_adm'); } catch (e) {}
  if (salva) { P.senha = salva; chamar('adm_ping').then(function () { abrir('pendentes'); }, function (e) { P.senha = ''; telaLogin(/senha|tentativas/i.test(e.message) ? e.message : ''); }); }
  else telaLogin();
})();
