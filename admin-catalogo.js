// Lumi · painel da dona: abas Catálogo (itens, promoções, regras) e Ajustes. Usa os ganchos de admin.js.
(function () {
  'use strict';
  var A = window.LumiAdmin;
  if (!A) return;
  var P = A.P, EXT = A.EXT, chamar = A.chamar;
  var CAT = { sub: 'sessao' }, FORM = null;
  var SUBS = [['sessao', 'Sessões'], ['pacote', 'Pacotes'], ['adicional', 'Adicionais'], ['promos', 'Promoções'], ['regras', 'Regras']];
  var DIAS = [['dom', 'Domingo'], ['seg', 'Segunda'], ['ter', 'Terça'], ['qua', 'Quarta'], ['qui', 'Quinta'], ['sex', 'Sexta'], ['sab', 'Sábado']];
  var TIPO_NOME = { sessao: 'sessão', pacote: 'pacote', adicional: 'adicional' };

  function money2(v) { return Number(v).toFixed(2).replace('.', ','); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function chk(id) { var e = document.getElementById(id); return !!(e && e.checked); }
  function dd(ds) { var p = ds.split('-'); return p[2] + '/' + p[1]; }
  function campo(rotulo, html, dica) { return '<label class="campo"><span>' + esc(rotulo) + '</span>' + html + (dica ? '<small class="aviso">' + dica + '</small>' : '') + '</label>'; }
  function inp(id, v, extra) { return '<input type="text" id="' + id + '" value="' + esc(v === undefined || v === null ? '' : v) + '" ' + (extra || '') + '>'; }
  function erroModal(msg) {
    var m = document.querySelector('.modal'); if (!m) return;
    var old = m.querySelector('.msg.erro'); if (old) old.remove();
    m.insertAdjacentHTML('afterbegin', '<div class="msg erro" role="alert">' + esc(msg) + '</div>'); m.scrollTop = 0;
  }
  function itensDe(tipo) { return (P.dados.catalogo.itens || []).filter(function (i) { return i.tipo === tipo; }); }

  /* ---------- carregar ---------- */
  EXT.loaders.catalogo = async function () { P.dados.catalogo = await chamar('adm_catalogo'); };
  EXT.loaders.ajustes = async function () { P.dados.config = await chamar('adm_config'); };

  /* ---------- aba Catálogo ---------- */
  function precoItem(i) {
    if (i.promo) return '<span class="de">' + brl(i.preco) + '</span>' + brl(i.preco_efetivo);
    return brl(i.preco);
  }
  function resumoItem(i) {
    if (i.tipo === 'adicional') return i.min_extra ? '+' + i.min_extra + ' min na sessão' : 'Adicional';
    if (i.tipo === 'sessao') return i.duracao_min + ' min';
    return i.sessoes + ' sessão(ões) de ' + i.duracao_min + ' min · validade ' + i.validade_dias + ' dias' + (i.intervalo_min_dias ? ' · intervalo ' + i.intervalo_min_dias + ' dias' : '');
  }
  function cardItem(i) {
    return '<div class="cartao' + (i.ativo ? '' : ' ') + '" style="' + (i.ativo ? '' : 'opacity:.6') + '"><div class="card-linha"><span class="nome">' + esc(i.nome) + '</span><span class="preco">' + precoItem(i) + '</span></div>' +
      '<div class="min">' + esc(resumoItem(i)) + '</div>' +
      '<div>' + (i.ativo ? '<span class="chip ok">Aparece no site</span>' : '<span class="chip erro">Oculto</span>') +
      (i.promo ? '<span class="chip ouro">' + esc(i.promo.nome) + ' até ' + esc(dd(i.promo.ate)) + '</span>' : '') +
      (i.usos ? '<span class="chip">' + i.usos + ' reserva(s) ativa(s)</span>' : '') + '</div>' +
      '<div class="acoes duas"><button type="button" class="btn-discreto" data-cat="item-editar" data-id="' + esc(i.id) + '">Editar</button>' +
      '<button type="button" class="' + (i.ativo ? 'btn-perigo' : 'btn-primario') + '" data-cat="item-ativar" data-id="' + esc(i.id) + '" data-ativo="' + (i.ativo ? '' : '1') + '">' + (i.ativo ? 'Ocultar do site' : 'Mostrar no site') + '</button></div></div>';
  }
  function statusPromo(p, hoje) {
    if (!p.ativo) return '<span class="chip erro">Desligada</span>';
    if (p.ate < hoje) return '<span class="chip">Encerrada</span>';
    if (p.de > hoje) return '<span class="chip">Agendada</span>';
    return '<span class="chip ok">Valendo agora</span>';
  }
  function viewCatalogo() {
    var d = P.dados.catalogo || { itens: [], promos: [], regras_comuns: [], hoje: A.hojeLocal() };
    var h = '<div class="filtros">' + SUBS.map(function (s) { return '<button type="button" data-cat="sub" data-v="' + s[0] + '" class="' + (CAT.sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (CAT.sub === 'promos') {
      h += '<div class="acoes"><button type="button" class="btn-primario" data-cat="promo-nova">+ Nova promoção</button></div>';
      if (!d.promos.length) return h + '<div class="vazio">Nenhuma promoção. Crie uma para baixar o preço por alguns dias.</div>';
      return h + d.promos.map(function (p) {
        return '<div class="cartao"><div class="card-linha"><span class="nome">' + esc(p.nome) + '</span><span class="preco">' + brl(p.preco) + '</span></div>' +
          '<div>' + esc(p.item_nome) + '</div><div class="min">De ' + esc(dd(p.de)) + ' até ' + esc(dd(p.ate)) + '</div><div>' + statusPromo(p, d.hoje) + '</div>' +
          '<div class="acoes duas"><button type="button" class="btn-discreto" data-cat="promo-editar" data-id="' + esc(p.id) + '">Editar</button>' +
          '<button type="button" class="btn-perigo" data-cat="promo-remover" data-id="' + esc(p.id) + '">Remover</button></div></div>';
      }).join('');
    }
    if (CAT.sub === 'regras') {
      return h + '<div class="cartao"><h3 style="margin-bottom:6px">Regras comuns</h3><p class="min">Aparecem para todas as clientes antes do Pix e no e-mail de confirmação. Uma regra por linha. ' +
        'Você pode usar <b>{sinal}</b> (percentual do sinal) e <b>{reag_horas}</b> (horas de antecedência para reagendar).</p>' +
        '<textarea id="regras-txt" rows="9">' + esc(d.regras_comuns.join('\n')) + '</textarea>' +
        '<div class="acoes"><button type="button" class="btn-primario" data-cat="regras-salvar">Salvar regras</button></div></div>';
    }
    var lista = itensDe(CAT.sub);
    h += '<div class="acoes"><button type="button" class="btn-primario" data-cat="item-novo">+ Novo ' + TIPO_NOME[CAT.sub] + '</button></div>';
    if (!lista.length) return h + '<div class="vazio">Nada por aqui ainda.</div>';
    return h + lista.map(cardItem).join('');
  }
  EXT.views.catalogo = viewCatalogo;

  /* ---------- formulário de item ---------- */
  function formItem(item, tipo) {
    var i = item || { tipo: tipo, nome: '', preco: '', preco_avulso: '', duracao_min: 60, sessoes: 2, validade_dias: 30, intervalo_min_dias: 0, inclui: [], regras: [], dur_primeira_vez: 0, mesmo_horario: false, unico_por_cliente: false, adicionais_ocultos: [], max_qtd: 1, min_extra: 0, ordem: 50 };
    FORM = { id: item ? item.id : null, tipo: i.tipo };
    var h = '<h3 style="margin-bottom:10px">' + (item ? 'Editar ' : 'Novo ') + TIPO_NOME[i.tipo] + '</h3>';
    h += campo('Nome', inp('f-nome', i.nome, 'maxlength="60" placeholder="Ex.: ' + (i.tipo === 'pacote' ? 'Pacote Verão' : i.tipo === 'sessao' ? 'Sessão de 120 min' : 'Máscara facial') + '"'));
    h += campo('Preço (R$)', inp('f-preco', i.preco === '' ? '' : money2(i.preco), 'inputmode="decimal" placeholder="Ex.: 120 ou 99,90"'));
    if (i.tipo !== 'adicional') h += campo(i.tipo === 'pacote' ? 'Duração de cada sessão (min)' : 'Duração (min)', inp('f-duracao', i.duracao_min, 'inputmode="numeric"'));
    if (i.tipo === 'adicional') h += campo('Minutos extras na sessão', inp('f-minextra', i.min_extra, 'inputmode="numeric"'), '0 se não aumenta o tempo da sessão.');
    if (i.tipo === 'pacote') {
      h += campo('Preço "de" (valor sem desconto)', inp('f-avulso', i.preco_avulso ? money2(i.preco_avulso) : '', 'inputmode="decimal"'), 'Mostra o preço riscado e a economia. Deixe vazio se não quiser.');
      h += campo('Quantidade de sessões', inp('f-sessoes', i.sessoes, 'inputmode="numeric"'));
      h += campo('Validade (dias corridos)', inp('f-validade', i.validade_dias, 'inputmode="numeric"'));
      h += campo('Intervalo mínimo entre sessões (dias)', inp('f-intervalo', i.intervalo_min_dias, 'inputmode="numeric"'), '0 = sem intervalo mínimo.');
      h += campo('O que inclui (uma linha por item)', '<textarea id="f-inclui" rows="4">' + esc(i.inclui.join('\n')) + '</textarea>');
      h += campo('Regras deste pacote (uma por linha)', '<textarea id="f-regras" rows="4">' + esc(i.regras.join('\n')) + '</textarea>',
        'Use <b>{validade}</b> e <b>{intervalo}</b> para o sistema preencher os números sozinho.');
      var ads = itensDe('adicional');
      h += '<details><summary>Opções avançadas</summary><div style="margin-top:10px">' +
        campo('Duração na primeira vez (min)', inp('f-primeira', i.dur_primeira_vez || '', 'inputmode="numeric" placeholder="vazio = igual à sessão"')) +
        '<label class="check"><input type="checkbox" id="f-mesmo"' + (i.mesmo_horario ? ' checked' : '') + '><span>Sessões no mesmo dia e horário (pacote em dupla)</span></label>' +
        '<label class="check"><input type="checkbox" id="f-unico"' + (i.unico_por_cliente ? ' checked' : '') + '><span>Só uma vez por cliente</span></label>' +
        campo('Máximo de cada adicional', inp('f-maxqtd', i.max_qtd, 'inputmode="numeric"')) +
        '<div class="aviso" style="margin-bottom:6px">Adicionais que já vêm inclusos (não aparecem para escolher):</div>' +
        ads.map(function (a) { return '<label class="check"><input type="checkbox" data-oculto="' + esc(a.id) + '"' + (i.adicionais_ocultos.indexOf(a.id) >= 0 ? ' checked' : '') + '><span>' + esc(a.nome) + '</span></label>'; }).join('') +
        '</div></details>';
    }
    h += '<details><summary>Ordem na lista</summary>' + campo('Número (menor aparece primeiro)', inp('f-ordem', i.ordem, 'inputmode="numeric"')) + '</details>';
    h += '<div class="acoes duas"><button type="button" class="btn-discreto" data-m="fechar">Cancelar</button><button type="button" class="btn-primario" data-cat="item-salvar" id="btn-salvar-item">Salvar</button></div>';
    A.abrirModal(h);
  }
  function coletarItem() {
    var b = { id: FORM.id, tipo: FORM.tipo, nome: val('f-nome'), preco: val('f-preco'), ordem: val('f-ordem') };
    if (FORM.tipo === 'adicional') b.min_extra = val('f-minextra');
    else b.duracao_min = val('f-duracao');
    if (FORM.tipo === 'pacote') {
      b.preco_avulso = val('f-avulso'); b.sessoes = val('f-sessoes'); b.validade_dias = val('f-validade'); b.intervalo_min_dias = val('f-intervalo');
      b.inclui = val('f-inclui'); b.regras = val('f-regras'); b.dur_primeira_vez = val('f-primeira'); b.mesmo_horario = chk('f-mesmo');
      b.unico_por_cliente = chk('f-unico'); b.max_qtd = val('f-maxqtd');
      b.adicionais_ocultos = [].slice.call(document.querySelectorAll('[data-oculto]')).filter(function (e) { return e.checked; }).map(function (e) { return e.dataset.oculto; });
    }
    return b;
  }

  /* ---------- formulário de promoção ---------- */
  function formPromo(promo) {
    var hoje = A.hojeLocal(), itens = (P.dados.catalogo.itens || []).filter(function (i) { return i.ativo || (promo && promo.item_id === i.id); });
    var p = promo || { id: null, item_id: itens[0] ? itens[0].id : '', nome: '', preco: '', de: hoje, ate: addDias(hoje, 7), ativo: true };
    FORM = { id: p.id };
    var h = '<h3 style="margin-bottom:10px">' + (promo ? 'Editar promoção' : 'Nova promoção') + '</h3>';
    h += campo('Item em promoção', '<select id="p-item">' + itens.map(function (i) { return '<option value="' + esc(i.id) + '"' + (i.id === p.item_id ? ' selected' : '') + '>' + esc(i.nome) + ' (' + TIPO_NOME[i.tipo] + ' · ' + brl(i.preco) + ')</option>'; }).join('') + '</select>');
    h += campo('Nome da promoção', inp('p-nome', p.nome, 'maxlength="60" placeholder="Ex.: Semana do Bronze"'));
    h += campo('Preço promocional (R$)', inp('p-preco', p.preco === '' ? '' : money2(p.preco), 'inputmode="decimal"'), 'O preço normal aparece riscado no site.');
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + campo('Começa em', '<input type="date" id="p-de" value="' + esc(p.de) + '">') + campo('Termina em', '<input type="date" id="p-ate" value="' + esc(p.ate) + '">') + '</div>';
    h += '<label class="check"><input type="checkbox" id="p-ativo"' + (p.ativo ? ' checked' : '') + '><span>Promoção ligada</span></label>';
    h += '<div class="acoes duas"><button type="button" class="btn-discreto" data-m="fechar">Cancelar</button><button type="button" class="btn-primario" data-cat="promo-salvar" id="btn-salvar-promo">Salvar</button></div>';
    A.abrirModal(h);
  }

  /* ---------- ações ---------- */
  async function recarregar(msg) {
    try { P.dados.catalogo = await chamar('adm_catalogo'); } catch (e) { P.erro = e.message; }
    P.modal = null; A.desenhar(); if (msg) toast(msg);
  }
  async function comBotao(id, rotulo, fn) {
    var b = document.getElementById(id); if (b) { b.disabled = true; b.textContent = 'Salvando...'; }
    try { await fn(); }
    catch (e) {
      if (/senha|tentativas/i.test(e.message)) { P.modal = null; return A.telaLogin(e.message); }
      erroModal(e.message); if (b) { b.disabled = false; b.textContent = rotulo; }
    }
  }

  EXT.click = function (t) {
    var c = t.dataset.cat; if (!c) return false;
    var d = P.dados.catalogo || { itens: [], promos: [] };
    if (c === 'sub') { CAT.sub = t.dataset.v; A.desenhar(); return true; }
    if (c === 'item-novo') { formItem(null, CAT.sub); return true; }
    if (c === 'item-editar') { formItem(d.itens.filter(function (i) { return i.id === t.dataset.id; })[0]); return true; }
    if (c === 'item-ativar') {
      chamar('adm_item_ativar', { id: t.dataset.id, ativo: !!t.dataset.ativo }).then(function () { return recarregar(t.dataset.ativo ? 'Item aparece no site' : 'Item oculto do site'); })
        .catch(function (e) { P.erro = e.message; A.desenhar(); });
      return true;
    }
    if (c === 'item-salvar') { comBotao('btn-salvar-item', 'Salvar', async function () { await chamar('adm_item_salvar', coletarItem()); await recarregar('Salvo!'); }); return true; }
    if (c === 'promo-nova') { formPromo(null); return true; }
    if (c === 'promo-editar') { formPromo(d.promos.filter(function (p) { return p.id === t.dataset.id; })[0]); return true; }
    if (c === 'promo-remover') {
      A.modalConfirmar('Remover promoção?', 'O preço volta ao normal no site na hora.', 'Remover', true, async function () {
        try { await chamar('adm_promo_remover', { id: t.dataset.id }); await recarregar('Promoção removida'); } catch (e) { erroModal(e.message); }
      });
      return true;
    }
    if (c === 'promo-salvar') {
      comBotao('btn-salvar-promo', 'Salvar', async function () {
        await chamar('adm_promo_salvar', { id: FORM.id, item_id: val('p-item'), nome: val('p-nome'), preco: val('p-preco'), de: val('p-de'), ate: val('p-ate'), ativo: chk('p-ativo') });
        await recarregar('Promoção salva!');
      });
      return true;
    }
    if (c === 'regras-salvar') {
      chamar('adm_regras_salvar', { linhas: val('regras-txt') }).then(function () { return recarregar('Regras salvas!'); })
        .catch(function (e) { P.erro = e.message; A.desenhar(); window.scrollTo({ top: 0 }); });
      return true;
    }
    if (c === 'config-salvar') { salvarConfig(); return true; }
    return false;
  };

  /* ---------- aba Ajustes ---------- */
  function horarioCampos(k, v) {
    var multi = /[,;]/.test(v), m = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(v.replace(/\s/g, ''));
    if (multi) return '<div class="min">' + esc(v) + ' (vários períodos: edite na planilha)</div>';
    return '<div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:8px;align-items:center"><label class="check" style="margin:0"><input type="checkbox" id="h-' + k + '-on"' + (v ? ' checked' : '') + '><span>Aberto</span></label>' +
      '<input type="time" id="h-' + k + '-a" value="' + (m ? m[1] : '09:00') + '"><input type="time" id="h-' + k + '-b" value="' + (m ? m[2] : '22:00') + '"></div>';
  }
  function viewAjustes() {
    var v = (P.dados.config || { valores: {} }).valores;
    var h = '<div class="cartao"><h3 style="margin-bottom:10px">Dados do negócio</h3>' +
      campo('Nome do negócio', inp('c-nome_negocio', v.nome_negocio, 'maxlength="60"')) +
      campo('WhatsApp da dona', inp('c-whatsapp_dona', v.whatsapp_dona, 'inputmode="tel" placeholder="11999999999"'), 'Com DDD. É o número do botão "Falar no WhatsApp".') +
      campo('E-mail que recebe os avisos de Pix', inp('c-email_dona', v.email_dona, 'inputmode="email"')) + '</div>';
    h += '<div class="cartao"><h3 style="margin-bottom:10px">Pagamento</h3>' +
      campo('Sinal (% do total)', inp('c-percentual_sinal', v.percentual_sinal, 'inputmode="numeric"')) +
      campo('Prazo para a cliente clicar "Já fiz o Pix" (min)', inp('c-prazo_pix_min', v.prazo_pix_min, 'inputmode="numeric"'), 'Passou do prazo sem aviso, a reserva expira e os horários voltam a ficar livres.') +
      '<p class="aviso">A chave Pix e o nome do recebedor só mudam na planilha, para evitar erros no recebimento.</p></div>';
    h += '<div class="cartao"><h3 style="margin-bottom:10px">Horário de funcionamento</h3>' + DIAS.map(function (d) {
      return '<div style="margin-bottom:12px"><div style="margin-bottom:4px">' + d[1] + '</div>' + horarioCampos(d[0], v['horario_' + d[0]] || '') + '</div>';
    }).join('') + '</div>';
    h += '<details class="cartao"><summary>Ajustes avançados</summary><div style="margin-top:10px">' +
      campo('Intervalo entre atendimentos (min)', inp('c-intervalo_min', v.intervalo_min, 'inputmode="numeric"')) +
      campo('De quantos em quantos minutos oferecer horários', inp('c-passo_min', v.passo_min, 'inputmode="numeric"')) +
      campo('Antecedência mínima para marcar no mesmo dia (min)', inp('c-antecedencia_min', v.antecedencia_min, 'inputmode="numeric"')) +
      campo('Quantos dias à frente a agenda abre', inp('c-horizonte_dias', v.horizonte_dias, 'inputmode="numeric"')) +
      campo('Máximo de reservas aguardando Pix por WhatsApp', inp('c-max_pendentes_whats', v.max_pendentes_whats, 'inputmode="numeric"')) +
      campo('Reagendamentos por contratação', inp('c-reag_max', v.reag_max, 'inputmode="numeric"')) +
      campo('Antecedência para reagendar (horas)', inp('c-reag_horas', v.reag_horas, 'inputmode="numeric"')) + '</div></details>';
    h += '<div class="acoes"><button type="button" class="btn-primario" data-cat="config-salvar" id="btn-config">Salvar ajustes</button></div>';
    return h;
  }
  EXT.views.ajustes = viewAjustes;

  async function salvarConfig() {
    var valores = {};
    ['nome_negocio', 'whatsapp_dona', 'email_dona', 'percentual_sinal', 'prazo_pix_min', 'intervalo_min', 'passo_min', 'antecedencia_min', 'horizonte_dias', 'max_pendentes_whats', 'reag_max', 'reag_horas'].forEach(function (k) {
      var e = document.getElementById('c-' + k); if (e) valores[k] = e.value;
    });
    DIAS.forEach(function (d) {
      var on = document.getElementById('h-' + d[0] + '-on'); if (!on) return;
      valores['horario_' + d[0]] = on.checked ? val('h-' + d[0] + '-a') + '-' + val('h-' + d[0] + '-b') : '';
    });
    var b = document.getElementById('btn-config'); if (b) { b.disabled = true; b.textContent = 'Salvando...'; }
    try { P.dados.config = await chamar('adm_config_salvar', { valores: valores }); P.erro = ''; toast('Ajustes salvos!'); }
    catch (e) {
      if (/senha|tentativas/i.test(e.message)) return A.telaLogin(e.message);
      P.erro = e.message;
    }
    A.desenhar(); window.scrollTo({ top: 0 });
  }
})();
