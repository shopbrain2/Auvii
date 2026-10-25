/* Auvii Crawl page: "Pages behind a login".
   Talks only to the crawl-login Edge Function through the signed-in session. The browser never receives a password,
   a cookie or any other secret back, and passwords typed here are cleared as soon as they are sent. */
(function () {
  'use strict';
  var KEY = 'auviiCrawlLoginUrl';
  var S = { url: '', info: null, busy: false, msg: '', msgKind: '', result: null, accounts: [], mode: '' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function agent() { try { return (typeof currentAgent !== 'undefined' && currentAgent) || null; } catch (e) { return null; } }
  function user() { try { return (typeof currentUser !== 'undefined' && currentUser) || null; } catch (e) { return null; } }
  function hostOf(u) { try { return new URL(u).host.toLowerCase(); } catch (e) { return ''; } }

  function css() {
    if ($('clStyles')) return;
    var st = document.createElement('style'); st.id = 'clStyles';
    st.textContent =
'.cl-card{margin-bottom:16px}.cl-card h3{margin:0 0 4px;font-size:16px}.cl-sub{color:var(--ink-soft);font-size:13px;margin:0 0 12px;line-height:1.5}' +
'.cl-row{display:flex;gap:8px;flex-wrap:wrap}.cl-row input{flex:1 1 200px;min-width:0}' +
'.cl-card input[type=text],.cl-card input[type=url],.cl-card input[type=email],.cl-card input[type=password]{width:100%;background:var(--paper);color:var(--ink);border:1.5px solid var(--line);border-radius:10px;padding:11px 12px;font:inherit;font-size:16px;outline:none}' +
'.cl-card input:focus{border-color:var(--cobalt)}' +
'.cl-box{margin-top:12px;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:var(--ov1,rgba(255,255,255,.03));font-size:13.5px;line-height:1.5}' +
'.cl-box.warn{border-color:rgba(245,179,1,.5);background:rgba(245,179,1,.1)}.cl-box.bad{border-color:rgba(255,107,69,.5);background:rgba(255,107,69,.1)}.cl-box.good{border-color:rgba(34,196,147,.5);background:rgba(34,196,147,.1)}' +
'.cl-box ul{margin:6px 0 0;padding-left:18px}' +
'.cl-tag{display:inline-block;font-size:11.5px;font-weight:800;padding:3px 9px;border-radius:99px;background:var(--ov3,rgba(255,255,255,.1))}.cl-tag.active{background:rgba(34,196,147,.18);color:#22A97E}.cl-tag.bad{background:rgba(255,107,69,.18);color:#E5593A}.cl-tag.wait{background:rgba(245,179,1,.18);color:#C48F00}' +
'.cl-opt{margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:14px}.cl-opt>b{display:block;margin-bottom:4px}' +
'.cl-opt label.chk{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--ink-soft);margin:10px 0;font-weight:500}.cl-opt label.chk input{width:auto;margin-top:3px}' +
'.cl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.cl-grid div{padding:9px 6px;border-radius:12px;background:var(--ov1,rgba(255,255,255,.04));text-align:center}.cl-grid b{display:block;font-size:19px}.cl-grid span{font-size:11.5px;color:var(--ink-soft)}' +
'.cl-pages{margin-top:8px;max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:12px}.cl-p{display:flex;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line);font-size:12.5px}.cl-p:last-child{border-bottom:0}.cl-p .i{flex:none;width:18px;text-align:center}.cl-p .u{min-width:0;overflow-wrap:anywhere}.cl-p .r{color:var(--ink-soft);display:block;font-size:11.5px}' +
'.cl-acc{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-top:10px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;font-size:13px}';
    document.head.appendChild(st);
  }

  function fn(action, extra) {
    var a = agent(); if (!a) return Promise.reject(new Error('Create your AI agent first.'));
    return sb.functions.invoke('crawl-login', { body: Object.assign({ action: action, agent_id: a.id }, extra || {}) }).then(function (r) {
      if (r.error) {
        var ctx = r.error.context; // supabase-js puts the response here when the function answered with an error
        if (ctx && typeof ctx.json === 'function') return ctx.json().then(function (j) { throw new Error((j && j.error) || 'Something went wrong.'); }, function () { throw new Error('Something went wrong.'); });
        throw new Error(r.error.message || 'Something went wrong.');
      }
      if (r.data && r.data.error) throw new Error(r.data.error);
      return r.data;
    });
  }

  function loadAccounts() {
    return sb.rpc('auvii_crawler_accounts_for_me').then(function (r) { S.accounts = (r && !r.error && r.data) || []; }).catch(function () { S.accounts = []; });
  }

  function setMsg(text, kind) { S.msg = text; S.msgKind = kind || ''; }

  var ICON = { ok: '&#10003;', needs_login: '&#128274;', needs_verification: '&#9993;', needs_manual: '&#9995;', blocked: '&#9940;', failed: '&#10007;', needs_js: '&#9881;', skipped: '&#8211;' };
  var LABEL = { ok: 'Read', needs_login: 'Needs a login', needs_verification: 'Needs email verification', needs_manual: 'Needs you', blocked: 'Not allowed by the website', failed: 'Failed', needs_js: 'Needs a browser', skipped: 'Skipped' };

  function accountsHtml() {
    var a = agent(); var host = hostOf(S.url);
    var mine = S.accounts.filter(function (x) { return a && x.agent_id === a.id && (!host || x.host === host); });
    if (!mine.length) return '';
    return mine.map(function (x) {
      var cls = x.status === 'active' ? 'active' : (x.status === 'needs_verification' || x.status === 'needs_manual') ? 'wait' : 'bad';
      var label = { active: 'Working', needs_verification: 'Needs email verification', needs_manual: 'Needs you', expired: 'Session expired', failed: 'Not working' }[x.status] || x.status;
      return '<div class="cl-acc"><div><b>' + esc(x.host) + '</b> <span class="cl-tag ' + cls + '">' + esc(label) + '</span><div style="color:var(--ink-soft);font-size:12px;margin-top:3px">' + (x.method === 'registered' ? 'Created by Auvii for ' : 'Login: ') + esc(x.email || '') + (x.note ? ' &middot; ' + esc(x.note) : '') + '</div></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' + ((x.status === 'needs_verification' || x.status === 'needs_manual' || x.status === 'expired') ? '<button type="button" class="btn btn-primary btn-sm" data-cl="continue" data-host="' + esc(x.host) + '">Continue</button>' : '') +
        '<button type="button" class="btn btn-ghost btn-sm" data-cl="forget" data-host="' + esc(x.host) + '">Remove saved login</button></div></div>';
    }).join('');
  }

  function resultHtml() {
    var r = S.result; if (!r) return '';
    var c = r.counts || {};
    var grid = '<div class="cl-grid"><div><b>' + (r.pages_read || 0) + '</b><span>Pages read</span></div><div><b>' + ((c.needs_login || 0) + (c.needs_verification || 0) + (c.needs_manual || 0)) + '</b><span>Need a login or you</span></div><div><b>' + ((c.failed || 0) + (c.blocked || 0) + (c.needs_js || 0)) + '</b><span>Blocked or failed</span></div></div>';
    var extra = (r.products_saved || r.faqs_saved) ? '<div class="cl-sub">Added from the pages: ' + (r.products_saved || 0) + ' product(s) and ' + (r.faqs_saved || 0) + ' FAQ(s) found in the website\'s own product and FAQ data.</div>' : '';
    var list = (r.pages || []).slice(0, 120).map(function (p) {
      var path = p.url; try { var u = new URL(p.url); path = u.pathname + u.search; } catch (e) {}
      return '<div class="cl-p"><span class="i">' + (ICON[p.state] || '') + '</span><span class="u">' + esc(path) + '<span class="r">' + esc(LABEL[p.state] || p.state) + (p.reason ? ' &middot; ' + esc(p.reason) : '') + '</span></span></div>';
    }).join('');
    return '<div class="cl-box ' + (r.complete ? 'good' : 'warn') + '"><b>' + (r.complete ? 'All reachable pages were read.' : 'Only part of the website was read.') + '</b>' + (r.complete ? '<div>' + esc(r.message || '') + '</div>' : '') + (r.auth && r.auth.note ? '<div style="margin-top:6px">' + esc(r.auth.note) + '</div>' : '') + '</div>' + grid + extra +
      '<div class="cl-sub" style="margin-bottom:4px">Every page and what happened to it:</div><div class="cl-pages">' + (list || '<div class="cl-p">No pages.</div>') + '</div>';
  }

  function optionsHtml() {
    var i = S.info; if (!i || !i.reachable) return '';
    if (!i.login_wall) return '<div class="cl-box good"><b>No login wall found on this page.</b><div>The normal crawler can read it. Other pages of the website may still ask for a login. If a crawl misses pages, run the login crawl below.</div></div>';
    var ev = (i.evidence || []).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('');
    var reg = i.registration || {};
    var u = user() || {};
    var regBox = reg.possible
      ? '<div class="cl-opt"><b>Let Auvii create an account for me</b><div class="cl-sub" style="margin:0">This website seems to allow normal sign-up. Auvii would register with <b>' + esc(u.email || 'your email') + '</b> and a random password that is stored encrypted. If the website sends a verification email it goes to you, and Auvii waits until you press Continue.</div>' +
        '<label class="chk"><input type="checkbox" id="clConsent"> I own this website or have permission to create an account on it.</label><button type="button" class="btn btn-ghost btn-sm" data-cl="register"' + (S.busy ? ' disabled' : '') + '>Create the account</button></div>'
      : '<div class="cl-opt"><b>Auvii will not create an account here</b><div class="cl-sub" style="margin:0">' + ((reg.reasons || []).map(esc).join(' ') || 'No simple sign-up was found.') + ' Please give Auvii a login you already have.</div></div>';
    var login = '<div class="cl-opt"><b>I have a login for this website</b><div class="cl-sub" style="margin:0 0 8px">Use an account made for this purpose if you can. It is saved encrypted and never shown again.</div>' +
      '<div style="display:grid;gap:8px"><input type="email" id="clEmail" placeholder="Email or username" autocomplete="off"><input type="password" id="clPass" placeholder="Password" autocomplete="new-password"></div>' +
      '<div style="margin-top:10px"><button type="button" class="btn btn-primary btn-sm" data-cl="connect"' + (S.busy ? ' disabled' : '') + '>Save and test login</button></div></div>';
    return '<div class="cl-box warn"><b>This website hides some content behind a login.</b><ul>' + ev + '</ul></div>' + login + regBox;
  }

  function paint() {
    var box = $('crawlLoginBox'); if (!box) return;
    css();
    if (!agent()) { box.innerHTML = ''; return; }
    box.innerHTML =
      '<div class="card cl-card"><h3>Pages behind a login</h3>' +
      '<p class="cl-sub">Some websites only show products or prices to logged-in visitors. Auvii reads the public pages first, then, with a login you approve, the pages that account can see. Auvii never solves CAPTCHAs, never enters payment details, and stops when a website needs a person.</p>' +
      '<div class="cl-row"><input type="url" id="clUrl" placeholder="https://yourwebsite.com" value="' + esc(S.url) + '" autocomplete="off"><button type="button" class="btn btn-ghost btn-sm" data-cl="inspect"' + (S.busy ? ' disabled' : '') + '>Check website</button></div>' +
      (S.msg ? '<div class="cl-box ' + (S.msgKind || '') + '">' + esc(S.msg) + '</div>' : '') +
      optionsHtml() + accountsHtml() +
      '<div style="margin-top:14px"><button type="button" class="btn btn-primary btn-sm" data-cl="crawl"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Working...' : 'Crawl, including pages behind the login') + '</button></div>' +
      resultHtml() + '</div>';
    wire(box);
  }

  function busy(on, msg, kind) { S.busy = on; if (msg !== undefined) setMsg(msg, kind); paint(); }

  function readUrl() {
    var v = ($('clUrl') && $('clUrl').value || S.url || '').trim();
    if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v;
    S.url = v; try { localStorage.setItem(KEY, v); } catch (e) {}
    return v;
  }

  function wire(box) {
    box.querySelectorAll('[data-cl]').forEach(function (b) {
      b.addEventListener('click', function () { act(b.dataset.cl, b.dataset.host); });
    });
  }

  async function act(what, host) {
    try {
      if (what === 'inspect') {
        var url = readUrl(); if (!url) { setMsg('Type your website address first.', 'warn'); paint(); return; }
        busy(true, 'Checking the website...');
        S.info = await fn('inspect', { url: url });
        busy(false, S.info.reachable ? '' : (S.info.message || 'Could not open that website.'), S.info.reachable ? '' : 'bad');
      } else if (what === 'connect') {
        var email = ($('clEmail') || {}).value || '', pass = ($('clPass') || {}).value || '';
        if (!email || !pass) { setMsg('Enter the email and password for that website.', 'warn'); paint(); return; }
        var loginUrl = (S.info && S.info.login_url) || readUrl();
        busy(true, 'Testing the login...');
        var r = await fn('connect', { login_url: loginUrl, probe_url: readUrl(), email: email, password: pass });
        if ($('clPass')) $('clPass').value = '';                     // the password never stays on screen
        await loadAccounts();
        busy(false, r.message, r.ok ? 'good' : (r.state === 'failed' ? 'bad' : 'warn'));
      } else if (what === 'register') {
        var consent = !!($('clConsent') && $('clConsent').checked);
        if (!consent) { setMsg('Please confirm you own this website or have permission to create an account on it.', 'warn'); paint(); return; }
        busy(true, 'Creating the account...');
        var rr = await fn('connect', { mode: 'register', consent: true, login_url: (S.info && S.info.login_url) || readUrl(), signup_url: S.info && S.info.registration && S.info.registration.signup_url, probe_url: readUrl() });
        await loadAccounts();
        busy(false, rr.message, rr.ok ? 'good' : 'warn');
      } else if (what === 'continue') {
        busy(true, 'Trying the login again...');
        var c = await fn('continue', { host: host, probe_url: readUrl() });
        await loadAccounts(); busy(false, c.message, c.ok ? 'good' : 'warn');
      } else if (what === 'forget') {
        if (!window.confirm('Remove the saved login for ' + host + '?')) return;
        await fn('forget', { host: host }); await loadAccounts(); busy(false, 'The saved login was removed.', 'good');
      } else if (what === 'crawl') {
        var cu = readUrl(); if (!cu) { setMsg('Type your website address first.', 'warn'); paint(); return; }
        var cap = (typeof auviiEnt === 'function') ? auviiEnt().pages : undefined;
        if (typeof auviiCrawlAllowed === 'function') {            // the plan's crawl allowance is respected
          var allow = await auviiCrawlAllowed();
          if (!allow.ok) { setMsg(allow.message, 'bad'); paint(); return; }
        }
        busy(true, 'Crawling. This can take a minute...'); S.result = null;
        var res = await fn('crawl', { url: cu, max_pages: cap });
        S.result = res; await loadAccounts();
        if (typeof auviiRecordCrawl === 'function') { auviiRecordCrawl(cu, cap).then(function () { if (typeof renderCrawlPlanBox === 'function') renderCrawlPlanBox(); }); }
        busy(false, '', '');
      }
    } catch (e) {
      busy(false, String((e && e.message) || e), 'bad');
    }
  }

  window.AuviiCrawlLogin = {
    render: function () {
      try { S.url = S.url || localStorage.getItem(KEY) || ''; } catch (e) {}
      paint(); loadAccounts().then(paint);
    }
  };
})();
