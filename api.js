// Comunicacao com o Web App (Apps Script).
// GET para leituras; POST com JSON em text/plain (evita preflight de CORS) para gravacoes e painel.
(function () {
  var TIMEOUT = 40000;

  function url() {
    var u = (window.LUMI_CONFIG || {}).API_URL || '';
    if (!/^https?:\/\//.test(u)) throw new Error('O site ainda não foi conectado ao sistema. Fale com a gente pelo WhatsApp.');
    return u;
  }

  async function chamar(fn, tentativas) {
    var ultimo;
    for (var i = 0; i < tentativas; i++) {
      var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, TIMEOUT);
      try {
        var r = await fn(ctl.signal);
        var txt = await r.text(), j;
        try { j = JSON.parse(txt); } catch (e) { throw new Error('O sistema respondeu algo inesperado. Tente novamente.'); }
        if (!j.ok) { var e2 = new Error(j.erro || 'Não foi possível concluir.'); e2.negocio = true; throw e2; }
        return j.data;
      } catch (e) {
        if (e.negocio) throw e;
        ultimo = e.name === 'AbortError' ? new Error('A conexão está lenta. Tente novamente em instantes.')
          : (e.message && e.message.indexOf('inesperado') >= 0 ? e : new Error('Sem conexão com o sistema. Confira sua internet e tente de novo.'));
        if (i + 1 < tentativas) await new Promise(function (ok) { setTimeout(ok, 800); });
      } finally { clearTimeout(timer); }
    }
    throw ultimo;
  }

  window.Api = {
    get: function (action, params) {
      var u = new URL(url());
      u.searchParams.set('action', action);
      Object.keys(params || {}).forEach(function (k) { u.searchParams.set(k, params[k]); });
      return chamar(function (signal) { return fetch(u.toString(), { signal: signal, redirect: 'follow' }); }, 2);
    },
    // POST nao e repetido automaticamente (evita reservar duas vezes)
    post: function (action, body) {
      var payload = JSON.stringify(Object.assign({ action: action }, body || {}));
      return chamar(function (signal) {
        return fetch(url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: payload, signal: signal, redirect: 'follow' });
      }, 1);
    }
  };

  window.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  window.brl = function (v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); };
  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  window.dataBR = function (ds) {
    var p = ds.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return DIAS[d.getUTCDay()] + ', ' + p[2] + '/' + p[1];
  };
  window.addDias = function (ds, n) {
    var p = ds.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
  };
  window.difDias = function (a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); };
  window.hm = function (s) { var p = s.split(':'); return +p[0] * 60 + +p[1]; };
  window.fmtHm = function (m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); };
  window.toast = function (msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800);
  };
  window.guardar = function (k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  window.ler = function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
})();
