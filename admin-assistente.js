// Lumi · painel da dona: aba Assistente (IA). Só números agregados vão para a IA; ela só sugere, nunca altera nada.
(function () {
  'use strict';
  var A = window.LumiAdmin;
  if (!A) return;
  var P = A.P, EXT = A.EXT, chamar = A.chamar;
  var S = { pergunta: '', texto: '', pergFeita: '', carregando: false, erro: '', dados: null, verDados: false, verDadosCarregando: false };
  var RAPIDAS = [
    ['Analisar meu mês', 'Faça uma análise geral do meu mês e diga as 3 ações mais importantes agora.'],
    ['O que preciso repor?', 'Quais insumos preciso comprar e quando, olhando meu estoque e o consumo?'],
    ['Meus preços estão bons?', 'Meus preços estão bons? Olhe o CMV de cada procedimento e sugira ajustes, sem eu ter que mudar nada agora.'],
    ['Ideia de pacote ou promoção', 'Tenho horários vazios nos próximos dias. Sugira um pacote ou promoção que faça sentido com meus números.']
  ];

  EXT.loaders.assistente = async function () { /* nada a carregar: a análise só roda quando você pergunta */ };

  function formata(t) { // texto da IA: escapa tudo primeiro e só depois permite negrito e marcadores
    return esc(t).split('\n').map(function (l) {
      return l.replace(/^\s*[-*]\s+/, '• ').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    }).join('<br>');
  }

  function view() {
    var h = '<div class="cartao"><h3 style="margin-bottom:6px">Assistente do Lumi ✨</h3>' +
      '<p class="min">Eu olho os <b>números</b> do seu negócio (financeiro, estoque, CMV, agenda) e sugiro o que fazer: preço, compra de material, pacote. ' +
      '<b>Nada muda sozinho</b>: quem decide é você. Nomes, telefones e e-mails de clientes <b>nunca</b> vão para a IA.</p></div>';
    if (S.erro) h += '<div class="msg erro" role="alert">' + esc(S.erro) + '</div>';
    h += '<div style="display:grid;gap:8px;margin:12px 0">' + RAPIDAS.map(function (r, i) {
      return '<button type="button" class="btn-discreto" data-ia="rapida" data-i="' + i + '"' + (S.carregando ? ' disabled' : '') + '>' + esc(r[0]) + '</button>';
    }).join('') + '</div>';
    h += '<label class="campo"><span>Ou pergunte o que quiser</span><textarea id="ia-pergunta" rows="3" maxlength="300" placeholder="Ex.: Vale a pena fazer uma promoção de 40 minutos na terça?">' + esc(S.pergunta) + '</textarea>' +
      '<small class="aviso">Até 300 letras.</small></label>' +
      '<div class="acoes"><button type="button" class="btn-primario" data-ia="perguntar"' + (S.carregando ? ' disabled' : '') + '>' + (S.carregando ? 'Pensando... (pode levar uns segundos)' : 'Perguntar') + '</button></div>';
    if (S.carregando) h += '<div class="carregando"><div class="spin"></div>Analisando seus números...</div>';
    if (S.texto) {
      h += '<div class="cartao" style="margin-top:14px">' + (S.pergFeita ? '<div class="min" style="margin-bottom:8px">Pergunta: ' + esc(S.pergFeita) + '</div>' : '') +
        '<div>' + formata(S.texto) + '</div>' +
        '<p class="min" style="margin-top:12px">Sugestões automáticas: confira antes de decidir. Sobre impostos e notas fiscais, confirme sempre com o seu contador.</p></div>';
    }
    h += '<details class="cartao" style="margin-top:14px"' + (S.verDados ? ' open' : '') + '><summary style="cursor:pointer"><b>Ver os números que são enviados à IA</b></summary><div style="margin-top:8px">';
    if (S.verDadosCarregando) h += '<div class="min">Carregando...</div>';
    else if (S.dados) h += '<p class="min" style="margin-bottom:6px">Só isto (sem nenhum dado de cliente):</p><pre style="white-space:pre-wrap;word-break:break-word;font-size:.72rem;max-height:320px;overflow:auto;margin:0">' + esc(JSON.stringify(S.dados, null, 1)) + '</pre>';
    else h += '<button type="button" class="btn-discreto" data-ia="carregardados">Mostrar</button>';
    h += '</div></details>';
    return h;
  }
  EXT.views.assistente = view;

  async function perguntar(texto) {
    if (S.carregando) return;
    S.pergunta = texto === undefined ? val() : texto; S.erro = ''; S.carregando = true; S.texto = ''; A.desenhar();
    try {
      var r = await chamar('adm_ia_perguntar', { pergunta: S.pergunta });
      S.texto = r.texto; S.pergFeita = S.pergunta;
    } catch (e) {
      if (/senha|tentativas/i.test(e.message)) { S.carregando = false; return A.telaLogin(e.message); }
      S.erro = e.message;
    }
    S.carregando = false; A.desenhar();
  }
  function val() { var e = document.getElementById('ia-pergunta'); return e ? e.value : S.pergunta; }

  var anterior = EXT.click;
  EXT.click = function (t, ev) {
    var c = t.dataset.ia;
    if (!c) return anterior ? anterior(t, ev) : false;
    if (c === 'rapida') { var r = RAPIDAS[+t.dataset.i]; perguntar(r[1]); return true; }
    if (c === 'perguntar') { S.pergunta = val(); perguntar(S.pergunta); return true; }
    if (c === 'carregardados') {
      if (S.dados || S.verDadosCarregando) return false;
      S.pergunta = val(); S.verDados = true; S.verDadosCarregando = true; A.desenhar();
      chamar('adm_ia_dados').then(function (d) { S.dados = d; }, function (e) { S.erro = e.message; }).then(function () { S.verDadosCarregando = false; A.desenhar(); });
      return true;
    }
    return false;
  };
  var root = document.getElementById('painel');
  root.addEventListener('input', function (ev) { if (ev.target.id === 'ia-pergunta') S.pergunta = ev.target.value; });
})();
