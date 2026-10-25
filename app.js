// Lumi · pagina da cliente
(function () {
  'use strict';
  var app = document.getElementById('app');
  var ETAPAS = ['Serviço', 'Datas', 'Seus dados', 'Pagamento'];
  var S = {
    cat: null, step: 0, aba: 'sessoes', item: null, adds: {}, primeira: false,
    slots: [], ativo: 0, mes: null, dias: {}, diaSel: null, carregandoMes: false, erroMes: '',
    dados: { nome: '', nome2: '', whats: '', email: '' }, ac1: false, ac2: false,
    reserva: null, enviando: false, erro: ''
  };
  var timer = null;

  /* ---------- calculos ---------- */
  function picks() { return S.item.mesmo_horario ? 1 : S.item.sessoes; }
  function listaAdds() {
    return S.cat.adicionais.filter(function (a) { return S.adds[a.id] > 0; }).map(function (a) { return { id: a.id, nome: a.nome, qtd: S.adds[a.id], preco: a.preco, min_extra: a.min_extra || 0 }; });
  }
  function calc() {
    var c = Math.round(S.item.preco * 100);
    listaAdds().forEach(function (a) { c += Math.round(a.preco * 100) * a.qtd; });
    var sinal = Math.round(c * S.cat.percentual_sinal / 100);
    return { total: c / 100, sinal: sinal / 100, restante: (c - sinal) / 100 };
  }
  function extraMin() { var m = 0; listaAdds().forEach(function (a) { m += a.min_extra * a.qtd; }); return m; }
  function durSessao(i) {
    var d = S.item.duracao_min;
    if (S.primeira && S.item.dur_primeira_vez > 0) d = S.item.dur_primeira_vez;
    return d + (i === 0 ? extraMin() : 0);
  }
  function limite() {
    return addDias(S.cat.hoje, S.item.validade_dias > 0 ? S.item.validade_dias : S.cat.horizonte_dias);
  }
  function outros() {
    var o = [];
    S.slots.forEach(function (s, i) { if (s && i !== S.ativo) o.push({ i: i, data: s.data, hora: s.hora }); });
    return o;
  }

  /* ---------- helpers de tela ---------- */
  function setHtml(h) { app.innerHTML = h; }
  function etapasHtml() {
    var n = Math.min(S.step, 3);
    return '<div class="etapas" aria-hidden="true">' + ETAPAS.map(function (_, i) { return '<i class="' + (i <= n || S.step === 4 ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="etapa-nome">' + (S.step === 4 ? 'Concluído' : 'Etapa ' + (n + 1) + ' de 4 · ' + ETAPAS[n]) + '</div>';
  }
  function erroHtml() { return S.erro ? '<div class="msg erro" role="alert">' + esc(S.erro) + '</div>' : ''; }
  function carregando(txt) { return '<div class="carregando"><div class="spin"></div>' + esc(txt || 'Carregando...') + '</div>'; }
  function irPara(n) { S.step = n; S.erro = ''; clearInterval(timer); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  /* ---------- render ---------- */
  function render() {
    if (!S.cat) return;
    if (S.step === 0) return telaServico();
    if (S.step === 1) return telaDatas();
    if (S.step === 2) return telaDados();
    if (S.step === 3) return S.reserva ? telaPix() : telaResumo();
    return telaFinal();
  }

  /* 0 — servico */
  function precoHtml(it) {
    if (it.tipo === 'pacote' && it.preco_avulso > it.preco)
      return '<span class="preco"><span class="de">' + brl(it.preco_avulso) + '</span>' + brl(it.preco) + '</span>';
    return '<span class="preco">' + brl(it.preco) + '</span>';
  }
  function cardItem(it) {
    var sel = S.item && S.item.id === it.id, extra = '';
    if (it.tipo === 'pacote') {
      extra = '<div>' + (it.economia > 0 ? '<span class="chip ouro">Economize ' + brl(it.economia) + '</span>' : '') +
        (it.preco_cada ? '<span class="chip">' + brl(it.preco_cada) + ' cada</span>' : '') +
        '<span class="chip">Validade ' + it.validade_dias + ' dias</span></div>' +
        '<ul class="inclui">' + it.inclui.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    } else extra = '<div class="min">' + it.duracao_min + ' min</div>';
    return '<button type="button" class="cartao' + (sel ? ' sel' : '') + '" data-a="item" data-id="' + esc(it.id) + '" aria-pressed="' + sel + '">' +
      '<div class="linha"><span class="nome">' + esc(it.nome) + '</span>' + precoHtml(it) + '</div>' + extra + '</button>';
  }
  function telaServico() {
    var lista = S.aba === 'sessoes' ? S.cat.sessoes : S.cat.pacotes;
    var h = etapasHtml() + '<div class="tela"><h2>Escolha seu bronze</h2><p class="lead">Selecione uma sessão avulsa ou um pacote.</p>' +
      '<div class="abas" role="tablist"><button type="button" data-a="aba" data-v="sessoes" class="' + (S.aba === 'sessoes' ? 'on' : '') + '">Sessões</button>' +
      '<button type="button" data-a="aba" data-v="pacotes" class="' + (S.aba === 'pacotes' ? 'on' : '') + '">Pacotes</button></div>' +
      lista.map(cardItem).join('');
    if (S.item) {
      var it = S.item, ads = S.cat.adicionais.filter(function (a) { return it.adicionais_ocultos.indexOf(a.id) < 0; });
      if (ads.length) {
        h += '<div class="cartao"><h3 style="margin-bottom:6px">Adicionais <span class="min">(opcional)</span></h3>' + ads.map(function (a) {
          var q = S.adds[a.id] || 0;
          return '<div class="add"><div><div>' + esc(a.nome) + '</div><div class="min">' + brl(a.preco) + '</div></div>' +
            '<div class="qtd"><button type="button" data-a="menos" data-id="' + esc(a.id) + '" aria-label="Menos ' + esc(a.nome) + '"' + (q <= 0 ? ' disabled' : '') + '>−</button><b>' + q + '</b>' +
            '<button type="button" data-a="mais" data-id="' + esc(a.id) + '" aria-label="Mais ' + esc(a.nome) + '"' + (q >= it.max_qtd ? ' disabled' : '') + '>+</button></div></div>';
        }).join('') + '</div>';
      }
      if (it.dur_primeira_vez > 0)
        h += '<div class="cartao' + (S.primeira ? ' sel' : '') + '"><label class="check" style="margin:0"><input type="checkbox" data-a="primeira"' + (S.primeira ? ' checked' : '') + '><span><b>' +
          (it.mesmo_horario ? 'É a primeira vez de vocês?' : 'É sua primeira vez?') + '</b><br><span class="min">A sessão fica com ' + it.dur_primeira_vez + ' min, com uma conversa rápida sobre a pele. Conferimos pelo seu WhatsApp e e-mail: se já houver agendamento anterior, vale a sessão normal de ' + it.duracao_min + ' min, com o valor integral.</span></span></label></div>';
      var c = calc();
      h += '<div class="totais"><div><span>Total</span><span>' + brl(c.total) + '</span></div>' +
        '<div class="destaque"><span>Sinal a pagar agora (' + S.cat.percentual_sinal + '%)</span><span>' + brl(c.sinal) + '</span></div>' +
        '<div><span>Restante, ao final da 1ª sessão</span><span>' + brl(c.restante) + '</span></div></div>';
      h += '<details><summary>Ver regras de ' + esc(it.nome) + '</summary><ul class="regras">' + it.regras.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></details>';
    }
    h += '<div class="acoes"><button type="button" class="btn-primario" data-a="avancar0"' + (S.item ? '' : ' disabled') + '>Escolher ' + (S.item && picks() > 1 ? 'datas' : 'data') + '</button></div></div>';
    setHtml(h);
  }

  /* 1 — datas */
  function mesDe(ds) { return ds.slice(0, 7); }
  function chaveCache(mes, i) { return [S.item.id, S.primeira ? 1 : 0, i === 0 ? 1 : 0, listaAdds().map(function (a) { return a.id + ':' + a.qtd; }).join(','), mes].join('|'); }
  var cacheDias = {};
  async function carregarMes() {
    var k = chaveCache(S.mes, S.ativo);
    if (cacheDias[k]) { S.dias = cacheDias[k]; S.erroMes = ''; return; }
    S.carregandoMes = true; S.erroMes = ''; telaDatas();
    try {
      var r = await Api.get('disponibilidade', {
        item: S.item.id, mes: S.mes, primeira: S.primeira ? '1' : '0', extra: S.ativo === 0 ? '1' : '0',
        adds: listaAdds().map(function (a) { return a.id + ':' + a.qtd; }).join(',')
      });
      cacheDias[k] = r.days; S.dias = r.days;
    } catch (e) { S.erroMes = e.message; S.dias = {}; }
    S.carregandoMes = false;
  }
  function horasDoDia(ds) {
    var gap = S.cat.intervalo_min, dur = durSessao(S.ativo), base = S.dias[ds] || [];
    return base.filter(function (h) {
      var ini = hm(h);
      return outros().every(function (o) {
        if (o.data !== ds) return true;
        var oi = hm(o.hora), od = durSessao(o.i);
        return !(ini < oi + od + gap && oi < ini + dur + gap);
      });
    });
  }
  function motivoDia(ds) {
    if (ds > limite()) return 'fora da validade';
    var I = S.item.intervalo_min_dias;
    if (I > 0 && outros().some(function (o) { return Math.abs(difDias(o.data, ds)) < I; })) return 'intervalo';
    if (!(S.dias[ds] && S.dias[ds].length)) return 'sem horários';
    if (!horasDoDia(ds).length) return 'sem horários';
    return '';
  }
  function capacidadeRestante() {
    // quantas sessoes ainda cabem respeitando intervalo e validade, dadas as ja escolhidas
    var I = S.item.intervalo_min_dias; if (I <= 0) return Infinity;
    var ds = S.slots.filter(Boolean).map(function (s) { return s.data; }).sort();
    var pontos = [addDias(S.cat.hoje, -I)].concat(ds).concat([addDias(limite(), I)]), cap = 0;
    for (var i = 0; i + 1 < pontos.length; i++) cap += Math.max(0, Math.floor(difDias(pontos[i], pontos[i + 1]) / I) - 1);
    return cap;
  }
  function calHtml() {
    var p = S.mes.split('-'), y = +p[0], m = +p[1], hoje = S.cat.hoje;
    var primeiro = new Date(Date.UTC(y, m - 1, 1)), dias = new Date(Date.UTC(y, m, 0)).getUTCDate(), off = primeiro.getUTCDay();
    var nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(primeiro);
    var h = '<div class="cal-topo"><button type="button" data-a="mes" data-v="-1" aria-label="Mês anterior"' + (S.mes <= mesDe(hoje) ? ' disabled' : '') + '>‹</button><div class="mes">' + esc(nomeMes) + '</div>' +
      '<button type="button" data-a="mes" data-v="1" aria-label="Próximo mês"' + (S.mes >= mesDe(limite()) ? ' disabled' : '') + '>›</button></div>';
    if (S.carregandoMes) return h + '<div class="cal">' + new Array(35).join('<div class="sk" style="aspect-ratio:1;min-height:42px"></div>') + '</div><p class="min" style="text-align:center">Buscando horários livres...</p>';
    h += '<div class="cal">' + ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(function (d) { return '<div class="dow">' + d + '</div>'; }).join('');
    for (var i = 0; i < off; i++) h += '<div></div>';
    var escolhidos = {}; outros().forEach(function (o) { escolhidos[o.data] = 1; });
    for (var d = 1; d <= dias; d++) {
      var ds = S.mes + '-' + ('0' + d).slice(-2), mot = ds < hoje ? 'passado' : motivoDia(ds), dis = !!mot;
      var cls = (S.slots[S.ativo] && S.slots[S.ativo].data === ds ? 'sel ' : '') + (S.diaSel === ds ? 'sel ' : '') + (escolhidos[ds] ? 'usado' : '');
      h += '<button type="button" data-a="dia" data-v="' + ds + '" class="' + cls + '"' + (dis ? ' disabled' : '') + ' aria-label="' + esc(dataBR(ds) + (dis ? ' — indisponível' : ' — horários livres')) + '">' + d + '</button>';
    }
    return h + '</div>';
  }
  function telaDatas() {
    var n = picks(), h = etapasHtml() + '<div class="tela"><h2>' + (n > 1 ? 'Escolha as datas' : 'Escolha a data') + '</h2>';
    var I = S.item.intervalo_min_dias, lim = limite();
    if (I > 0 && (n - 1) * I > S.item.validade_dias) {
      setHtml(h + '<div class="msg erro">Com ' + n + ' sessões e intervalo mínimo de ' + I + ' dias, não cabe nos ' + S.item.validade_dias + ' dias de validade. Fale com a gente pelo WhatsApp.</div>' +
        '<div class="acoes"><button type="button" class="btn-discreto" data-a="voltar">Voltar</button></div></div>'); return;
    }
    h += '<p class="lead">' + (S.item.mesmo_horario ? 'As duas sessões acontecem no mesmo dia e horário. ' : '') +
      (n > 1 ? 'Escolha todas as ' + n + ' sessões agora. ' : '') + 'Dentro da validade, até <b>' + esc(dataBR(lim)) + '</b>.' +
      (I > 0 ? ' Mínimo de <b>' + I + ' dias</b> entre as sessões.' : '') + '</p>';
    if (n > 1) {
      h += '<div class="sess-lista">' + S.slots.map(function (s, i) {
        return '<button type="button" class="sess' + (i === S.ativo ? ' on' : '') + (s ? ' feita' : '') + '" data-a="ativar" data-v="' + i + '"><span><span class="rot">Sessão ' + (i + 1) + ' · ' + durSessao(i) + ' min</span><br>' +
          (s ? esc(dataBR(s.data) + ' às ' + s.hora) : 'Toque para escolher') + '</span><span>' + (s ? '✓' : '') + '</span></button>';
      }).join('') + '</div>';
    }
    h += erroHtml();
    var faltam = S.slots.filter(function (s) { return !s; }).length;
    if (faltam > 0 && S.slots.some(Boolean) && capacidadeRestante() < faltam)
      h += '<div class="msg erro">Com essas datas não sobra espaço para as outras sessões respeitando o intervalo e a validade. Mude alguma data.</div>';
    h += '<div class="cartao">' + calHtml();
    if (S.erroMes) h += '<div class="msg erro" role="alert">' + esc(S.erroMes) + ' <button type="button" class="btn-discreto btn-mini" data-a="recarregar">Tentar de novo</button></div>';
    if (!S.carregandoMes && !S.erroMes) {
      var disp = Object.keys(S.dias).filter(function (d) { return !motivoDia(d); }).length;
      if (!disp) h += '<div class="msg info">Nenhum dia livre neste mês' + (I > 0 && outros().length ? ' que respeite o intervalo das outras sessões' : '') + '. Veja o mês seguinte' + (I > 0 && outros().length ? ' ou altere as outras datas' : '') + '.</div>';
    }
    if (S.diaSel && !S.carregandoMes) {
      var hs = horasDoDia(S.diaSel);
      h += '<h3 style="margin:16px 0 4px">' + esc(dataBR(S.diaSel)) + '</h3><div class="horas">' + hs.map(function (x) {
        return '<button type="button" data-a="hora" data-v="' + x + '" class="' + (S.slots[S.ativo] && S.slots[S.ativo].data === S.diaSel && S.slots[S.ativo].hora === x ? 'sel' : '') + '">' + x + '</button>';
      }).join('') + '</div>';
      if (!hs.length) h += '<p class="msg info">Esse dia ficou sem horários livres. Escolha outra data.</p>';
    }
    h += '</div>';
    var completo = S.slots.every(Boolean);
    h += '<div class="acoes duas"><button type="button" class="btn-discreto" data-a="voltar">Voltar</button><button type="button" class="btn-primario" data-a="avancar1"' + (completo ? '' : ' disabled') + '>Continuar</button></div></div>';
    setHtml(h);
  }

  /* 2 — dados */
  function maskFone(v) {
    var d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d ? '(' + d : '';
    if (d.length <= 7) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }
  function dadosOk() {
    var d = S.dados, fone = d.whats.replace(/\D/g, '');
    return d.nome.trim().length >= 2 && (!S.item.mesmo_horario || d.nome2.trim().length >= 2) && (fone.length === 10 || fone.length === 11) && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim());
  }
  function telaDados() {
    var d = S.dados, dupla = S.item.mesmo_horario;
    setHtml(etapasHtml() + '<div class="tela"><h2>Seus dados</h2><p class="lead">Para confirmar e avisar você sobre o agendamento.</p>' +
      '<label class="campo"><span>' + (dupla ? 'Seu nome' : 'Seu nome') + '</span><input type="text" data-f="nome" autocomplete="name" maxlength="80" placeholder="Como você se chama?" value="' + esc(d.nome) + '"></label>' +
      (dupla ? '<label class="campo"><span>Nome da sua amiga</span><input type="text" data-f="nome2" maxlength="80" placeholder="Quem vem com você?" value="' + esc(d.nome2) + '"></label>' : '') +
      '<label class="campo"><span>Seu WhatsApp</span><input type="tel" inputmode="numeric" data-f="whats" autocomplete="tel" placeholder="(11) 90000-0000" value="' + esc(d.whats) + '"></label>' +
      '<label class="campo"><span>Seu e-mail</span><input type="email" data-f="email" autocomplete="email" maxlength="120" placeholder="voce@email.com" value="' + esc(d.email) + '"></label>' +
      (S.primeira ? '<div class="msg info">Vamos conferir se é mesmo a sua primeira vez pelo WhatsApp e e-mail informados.</div>' : '') + erroHtml() +
      '<p class="aviso">Usamos seus dados apenas para o agendamento.</p>' +
      '<div class="acoes duas"><button type="button" class="btn-discreto" data-a="voltar">Voltar</button><button type="button" class="btn-primario" data-a="avancar2" id="btn-dados"' + (dadosOk() ? '' : ' disabled') + '>Continuar</button></div></div>');
  }

  /* 3 — resumo e regras */
  function sessoesHtml(lista) {
    return '<ul class="resumo-sessoes">' + lista.map(function (s, i) {
      return '<li>✦ ' + (lista.length > 1 ? 'Sessão ' + (s.n || i + 1) + ': ' : '') + esc(dataBR(s.data) + ' às ' + (s.hora || s.inicio)) + '</li>';
    }).join('') + '</ul>';
  }
  function telaResumo() {
    var c = calc(), it = S.item, h = etapasHtml() + '<div class="tela"><h2>Confirme seu pedido</h2>' + erroHtml();
    h += '<div class="cartao"><div class="linha"><span class="nome">' + esc(it.nome) + '</span><span class="preco">' + brl(it.preco) + '</span></div>' +
      listaAdds().map(function (a) { return '<div class="min">+ ' + esc(a.nome) + (a.qtd > 1 ? ' x' + a.qtd : '') + ' · ' + brl(a.preco * a.qtd) + '</div>'; }).join('') +
      '<div style="margin-top:8px">' + esc(S.dados.nome) + (it.mesmo_horario ? ' e ' + esc(S.dados.nome2) : '') + '</div>' +
      (it.mesmo_horario ? '<div class="min">As duas no mesmo horário</div>' : '') +
      sessoesHtml(S.slots) + '</div>';
    h += '<div class="totais"><div><span>Total</span><span>' + brl(c.total) + '</span></div>' +
      '<div class="destaque"><span>Sinal a pagar agora (' + S.cat.percentual_sinal + '%)</span><span>' + brl(c.sinal) + '</span></div>' +
      '<div><span>Restante, ao final da 1ª sessão</span><span>' + brl(c.restante) + '</span></div></div>';
    h += '<div class="cartao"><h3 style="margin-bottom:8px">Regras</h3><ul class="regras">' + it.regras.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';
    h += '<label class="check"><input type="checkbox" data-a="ac1"' + (S.ac1 ? ' checked' : '') + '><span>Li e concordo com as regras</span></label>' +
      '<label class="check"><input type="checkbox" data-a="ac2"' + (S.ac2 ? ' checked' : '') + '><span>Declaro que não me enquadro nas restrições de atendimento</span></label>';
    h += '<div class="acoes duas"><button type="button" class="btn-discreto" data-a="voltar"' + (S.enviando ? ' disabled' : '') + '>Voltar</button>' +
      '<button type="button" class="btn-primario" id="btn-pix" data-a="gerarpix"' + (S.ac1 && S.ac2 && !S.enviando ? '' : ' disabled') + '>' + (S.enviando ? 'Reservando...' : 'Ver Pix') + '</button></div></div>';
    setHtml(h);
  }

  function qrSvg(texto) {
    try {
      var q = qrcode(0, 'M'); q.addData(texto); q.make();
      return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (e) { return '<div class="msg erro">Não foi possível gerar o QR Code. Use o código copia e cola abaixo.</div>'; }
  }
  function telaPix() {
    var r = S.reserva, h = etapasHtml() + '<div class="tela pix"><h2>Pague o sinal via Pix</h2>' +
      '<p class="lead">Seus horários estão reservados. Pague <b>' + brl(r.sinal) + '</b> e depois toque em “Já fiz o Pix”.</p>' + erroHtml();
    h += '<div class="relogio" id="relogio" role="timer"></div>';
    h += '<div class="qr" aria-label="QR Code do Pix">' + qrSvg(r.pix.brcode) + '</div>';
    h += '<label class="campo" style="text-align:left"><span>Pix copia e cola</span><textarea class="copia" id="copia" readonly rows="4">' + esc(r.pix.brcode) + '</textarea></label>';
    h += '<div class="acoes"><button type="button" class="btn-discreto" data-a="copiar">Copiar código</button></div>';
    h += '<div class="totais" style="text-align:left"><div><span>Total</span><span>' + brl(r.total) + '</span></div><div class="destaque"><span>Sinal agora</span><span>' + brl(r.sinal) + '</span></div><div><span>Restante, ao final da 1ª sessão</span><span>' + brl(r.restante) + '</span></div></div>';
    h += '<div style="text-align:left;margin-top:10px">' + sessoesHtml(r.sessoes) + '</div>';
    h += '<div class="acoes"><button type="button" class="btn-primario" data-a="jafiz"' + (S.enviando ? ' disabled' : '') + '>' + (S.enviando ? 'Enviando...' : 'Já fiz o Pix') + '</button></div></div>';
    setHtml(h);
    iniciaRelogio(r.expira_em);
  }
  function iniciaRelogio(iso) {
    clearInterval(timer);
    var el = document.getElementById('relogio'); if (!el || !iso) return;
    function tick() {
      var s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
      if (s <= 0) { el.textContent = 'O prazo para o Pix terminou. Se já pagou, toque em “Já fiz o Pix”.'; clearInterval(timer); return; }
      el.textContent = 'Reserva garantida por ' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    }
    tick(); timer = setInterval(tick, 1000);
  }

  /* 4 — final */
  function telaFinal() {
    var r = S.reserva, wpp = S.cat.whatsapp, confirmado = r.status === 'Confirmado';
    var msg = 'Oi! Sou ' + r.nome + '. Fiz o agendamento ' + r.codigo + ' (' + r.item_nome + ') e queria falar sobre ele.';
    setHtml(etapasHtml() + '<div class="tela"><div class="ok-grande">✦</div><h2 style="text-align:center">' + (confirmado ? 'Agendamento confirmado!' : 'Recebemos seu aviso!') + '</h2>' +
      '<p class="lead" style="text-align:center">' + (confirmado ? 'Está tudo certo. Enviamos os detalhes por e-mail.' : 'Assim que a dona confirmar o Pix, você recebe a confirmação por e-mail.') + '</p>' +
      '<div class="cartao"><div class="nome">' + esc(r.item_nome) + '</div>' + sessoesHtml(r.sessoes) +
      '<div class="min" style="margin-top:8px">Sinal ' + brl(r.sinal) + ' · Restante ' + brl(r.restante) + ' ao final da 1ª sessão</div>' +
      '<div class="min">Código da reserva: <b>' + esc(r.codigo) + '</b></div></div>' +
      '<div class="acoes">' + (wpp ? '<a class="btn-primario" target="_blank" rel="noopener" href="https://wa.me/' + wpp + '?text=' + encodeURIComponent(msg) + '">Falar no WhatsApp</a>' : '') +
      '<button type="button" class="btn-discreto" data-a="novo">Fazer outro agendamento</button></div></div>');
  }

  /* ---------- acoes ---------- */
  var A = {
    aba: function (d) { S.aba = d.v; telaServico(); },
    item: function (d) {
      var all = S.cat.sessoes.concat(S.cat.pacotes), it = all.filter(function (x) { return x.id === d.id; })[0];
      if (!S.item || S.item.id !== it.id) {
        S.item = it; S.adds = {}; S.primeira = false; S.slots = []; cacheDias = {};
      }
      telaServico();
    },
    mais: function (d) { var a = S.cat.adicionais.filter(function (x) { return x.id === d.id; })[0]; S.adds[d.id] = Math.min(S.item.max_qtd, (S.adds[d.id] || 0) + 1); S.slots = []; cacheDias = {}; telaServico(); },
    menos: function (d) { S.adds[d.id] = Math.max(0, (S.adds[d.id] || 0) - 1); S.slots = []; cacheDias = {}; telaServico(); },
    primeira: function (d, ev) { S.primeira = ev.target.checked; S.slots = []; cacheDias = {}; telaServico(); },
    avancar0: async function () {
      var n = picks();
      if (S.slots.length !== n) S.slots = new Array(n).fill(null);
      S.ativo = Math.max(0, S.slots.indexOf(null)); if (S.ativo < 0) S.ativo = 0;
      S.diaSel = null; S.mes = S.mes && S.mes >= S.cat.hoje.slice(0, 7) ? S.mes : S.cat.hoje.slice(0, 7);
      S.step = 1; S.erro = ''; window.scrollTo({ top: 0 });
      await carregarMes(); telaDatas();
    },
    ativar: async function (d) {
      S.ativo = +d.v; S.diaSel = S.slots[S.ativo] ? S.slots[S.ativo].data : null;
      if (S.diaSel) S.mes = mesDe(S.diaSel);
      await carregarMes();
      // se o mes atual nao tem nenhum dia possivel (ex.: intervalo de 7 dias), pula para o proximo mes com dias livres
      for (var t = 0; t < 3 && !S.erroMes && !S.diaSel && S.mes < mesDe(limite()) &&
        !Object.keys(S.dias).some(function (d) { return !motivoDia(d); }); t++) {
        var p = S.mes.split('-'); S.mes = new Date(Date.UTC(+p[0], +p[1], 1)).toISOString().slice(0, 7);
        await carregarMes();
      }
      telaDatas();
    },
    mes: async function (d) {
      var p = S.mes.split('-'), dt = new Date(Date.UTC(+p[0], +p[1] - 1 + (+d.v), 1));
      S.mes = dt.toISOString().slice(0, 7); S.diaSel = null; await carregarMes(); telaDatas();
    },
    recarregar: async function () { cacheDias = {}; await carregarMes(); telaDatas(); },
    dia: function (d) { S.diaSel = d.v; telaDatas(); },
    hora: function (d) {
      S.slots[S.ativo] = { data: S.diaSel, hora: d.v };
      var prox = S.slots.indexOf(null);
      if (prox >= 0 && prox !== S.ativo) { S.ativo = prox; S.diaSel = null; return A.ativar({ v: prox }); }
      telaDatas();
    },
    avancar1: function () { irPara(2); },
    avancar2: async function () {
      if (!dadosOk()) return;
      if (S.primeira) {
        var b = document.getElementById('btn-dados'); if (b) { b.disabled = true; b.textContent = 'Conferindo...'; }
        try {
          var r = await Api.post('checar_primeira', { whatsapp: S.dados.whats, email: S.dados.email });
          if (!r.pode) {
            S.primeira = false; S.slots = []; cacheDias = {};
            await A.avancar0(); S.erro = r.mensagem; telaDatas(); return;
          }
        } catch (e) { S.erro = e.message; telaDados(); return; }
      }
      S.ac1 = S.ac2 = false; irPara(3);
    },
    ac1: function (d, ev) { S.ac1 = ev.target.checked; atualizaBtnPix(); },
    ac2: function (d, ev) { S.ac2 = ev.target.checked; atualizaBtnPix(); },
    voltar: function () { irPara(Math.max(0, S.step - 1)); },
    gerarpix: async function () {
      if (!(S.ac1 && S.ac2) || S.enviando) return;
      S.enviando = true; S.erro = ''; telaResumo();
      try {
        var r = await Api.post('criar', {
          item: S.item.id, adicionais: listaAdds().map(function (a) { return { id: a.id, qtd: a.qtd }; }),
          nome: S.dados.nome, nome2: S.dados.nome2, whatsapp: S.dados.whats, email: S.dados.email, primeira: S.primeira,
          slots: S.slots, aceite_regras: S.ac1, aceite_restricoes: S.ac2
        });
        S.reserva = r; guardar('lumi_res', { codigo: r.codigo, whats: S.dados.whats, t: Date.now() });
        S.enviando = false; irPara(3);
      } catch (e) {
        S.enviando = false; S.erro = e.message; telaResumo();
        if (/ocupado|intervalo|validade|horário/i.test(e.message)) {
          cacheDias = {};
          app.insertAdjacentHTML('beforeend', '<div class="acoes"><button type="button" class="btn-discreto" data-a="trocar">Escolher outras datas</button></div>');
        }
      }
    },
    trocar: function () { S.slots = new Array(picks()).fill(null); cacheDias = {}; A.avancar0(); },
    copiar: async function () {
      var t = S.reserva.pix.brcode;
      try { await navigator.clipboard.writeText(t); toast('Código copiado!'); }
      catch (e) { var el = document.getElementById('copia'); el.select(); try { document.execCommand('copy'); toast('Código copiado!'); } catch (e2) { toast('Selecione e copie o código'); } }
    },
    jafiz: async function () {
      if (S.enviando) return; S.enviando = true; S.erro = ''; telaPix();
      try {
        S.reserva = await Api.post('jafizpix', { codigo: S.reserva.codigo, whatsapp: S.dados.whats || (ler('lumi_res') || {}).whats });
        S.enviando = false; irPara(4);
      } catch (e) { S.enviando = false; S.erro = e.message; telaPix(); }
    },
    novo: function () {
      guardar('lumi_res', null);
      S.item = null; S.adds = {}; S.slots = []; S.reserva = null; S.ac1 = S.ac2 = false; S.primeira = false; cacheDias = {};
      irPara(0);
    }
  };
  function atualizaBtnPix() { var b = document.getElementById('btn-pix'); if (b) b.disabled = !(S.ac1 && S.ac2); }

  app.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-a]'); if (!b || b.tagName === 'INPUT' || !A[b.dataset.a] || b.disabled) return;
    A[b.dataset.a](b.dataset, ev);
  });
  app.addEventListener('change', function (ev) {
    var b = ev.target; if (b.tagName === 'INPUT' && b.type === 'checkbox' && A[b.dataset.a]) A[b.dataset.a](b.dataset, ev);
  });
  app.addEventListener('input', function (ev) {
    var f = ev.target.dataset && ev.target.dataset.f; if (!f) return;
    if (f === 'whats') ev.target.value = maskFone(ev.target.value);
    S.dados[f] = ev.target.value;
    var bt = document.getElementById('btn-dados'); if (bt) bt.disabled = !dadosOk();
  });

  /* ---------- inicio ---------- */
  async function init() {
    setHtml(carregando('Carregando horários e valores...'));
    try {
      S.cat = await Api.get('catalogo');
    } catch (e) {
      setHtml('<div class="msg erro" role="alert">' + esc(e.message) + '</div><div class="acoes"><button type="button" class="btn-discreto" id="tentar">Tentar de novo</button></div>');
      document.getElementById('tentar').onclick = init; return;
    }
    var salvo = ler('lumi_res');
    if (salvo && salvo.codigo && Date.now() - (salvo.t || 0) < 3 * 86400000) {
      try {
        var r = await Api.post('consultar', { codigo: salvo.codigo, whatsapp: salvo.whats });
        if (r.status === 'Aguardando Pix') { S.reserva = r; S.dados.whats = salvo.whats; S.item = null; S.step = 3; return render(); }
        if (r.status === 'Aguardando confirmação' || r.status === 'Confirmado') { S.reserva = r; S.step = 4; return render(); }
        guardar('lumi_res', null);
      } catch (e) { if (e.negocio) guardar('lumi_res', null); }
    } else if (salvo) guardar('lumi_res', null);
    render();
  }
  init();
})();
