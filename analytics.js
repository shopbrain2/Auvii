/* Auvii Analytics - chart-first dashboard.
   Loaded by account.html. Uses the page's own `sb` (Supabase client), `currentAgent`,
   `getAuviiPlanKey()` and `showView()`. All numbers come from the secure auvii_an_* database
   functions (auvii-analytics.sql). Nothing is invented: when data is missing the page says so. */
(function () {
  'use strict';

  var TZ = (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } })();
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var S = {
    range: '30d', custom: { from: '', to: '' },
    showConv: true, showMsg: true, compare: true,
    data: null, status: 'idle', err: '',
    filter: 'all', search: '', sort: 'newest', drill: null, tab: 'overview',
    list: { rows: [], total: 0, loading: false, err: '' },
    pinned: -1, loadToken: 0
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function fmt(n) { return num(n).toLocaleString(); }
  function agentId() { try { return (typeof currentAgent !== 'undefined' && currentAgent && currentAgent.id) || null; } catch (e) { return null; } }

  /* Plan depth: 0 = no access, 1 = Basic, 2 = Standard, 3 = Premium and the 7-day trial */
  function rank() {
    var k = 'free';
    try { k = getAuviiPlanKey(); } catch (e) {}
    return k === 'expired' ? 0 : k === 'basic' ? 1 : k === 'standard' ? 2 : 3;
  }

  function rpc(name, args) {
    return sb.rpc(name, args).then(function (r) {
      if (r.error) throw new Error(r.error.message || 'Request failed');
      return r.data;
    });
  }

  /* ---------- dates ---------- */
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function rangeDates() {
    var today = startOfDay(new Date());
    var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (S.range === 'today') return { from: today, to: tomorrow };
    if (S.range === 'custom' && S.custom.from && S.custom.to) {
      var f = new Date(S.custom.from + 'T00:00:00'), t = new Date(S.custom.to + 'T00:00:00');
      t.setDate(t.getDate() + 1);
      if (t > f) return { from: f, to: t };
    }
    var n = S.range === '7d' ? 7 : S.range === '90d' ? 90 : 30;
    var from = new Date(today); from.setDate(from.getDate() - (n - 1));
    return { from: from, to: tomorrow };
  }
  function parseD(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function shortDate(s) { var d = parseD(s); return d.getDate() + ' ' + MON[d.getMonth()]; }
  function longDate(s) { var d = parseD(s); return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function hourLabel(h) { return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? ' AM' : ' PM'); }
  function ago(iso) {
    var t = new Date(iso).getTime(); if (!t) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' d ago';
    var d = new Date(iso); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
  }
  function dur(sec) { sec = num(sec); if (!sec) return '-'; if (sec < 90) return Math.round(sec) + ' sec'; if (sec < 5400) return Math.round(sec / 60) + ' min'; return (sec / 3600).toFixed(1) + ' h'; }

  /* ---------- maths ---------- */
  function pct(cur, prev) { return num(prev) > 0 ? ((num(cur) - num(prev)) / num(prev)) * 100 : null; }
  function niceStep(x) { var p = Math.pow(10, Math.floor(Math.log10(x || 1))); var f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  function rate(a, u) { var t = num(a) + num(u); return t > 0 ? (num(a) / t) * 100 : null; }
  function hasPrev(d) { var p = d.prev || {}; return num(p.conversations) + num(p.messages) + num(p.clicks) > 0; }
  function sum(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }

  /* ---------- styles (use the Auvii theme variables already on the page) ---------- */
  function injectCss() {
    if ($('anStyles')) return;
    var st = document.createElement('style'); st.id = 'anStyles';
    st.textContent =
'.an{max-width:1100px;margin:0 auto;padding-bottom:40px}' +
'.an *{box-sizing:border-box}' +
'.an-head{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;justify-content:space-between;margin-bottom:18px}' +
'.an-head h1{margin:0;font-size:28px;line-height:1.1}' +
'.an-head p{margin:6px 0 0;color:var(--ink-soft);font-size:14px;max-width:560px}' +
'.an-ctrl{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
'.an-seg{display:inline-flex;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:12px;padding:3px;max-width:100%;overflow-x:auto}' +
'.an-seg button{border:0;background:transparent;color:var(--ink-soft);font:600 13px inherit;font-family:inherit;padding:8px 12px;border-radius:9px;cursor:pointer;white-space:nowrap}' +
'.an-seg button.on{background:var(--cobalt);color:#fff}' +
'.an-seg button[disabled]{opacity:.45;cursor:not-allowed}' +
'.an-custom{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}' +
'.an-custom input{background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--ink);border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;color-scheme:dark}' +
'.an-sec{margin-top:34px;padding-top:26px;border-top:1px solid var(--line);scroll-margin-top:64px}' +
'.an-sec:first-of-type{border-top:0}' +
'.an-nav + .an-sec{margin-top:14px;padding-top:6px}' +
'.an-nav{position:sticky;top:0;z-index:20;margin:0 -16px 6px;padding:8px 16px;background:rgba(7,10,18,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}' +
'.an-nav::-webkit-scrollbar{display:none}' +
'.an-nav a{flex:none;color:var(--ink-soft);text-decoration:none;font:600 13px inherit;font-family:inherit;padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.03);cursor:pointer}' +
'.an-nav a.on{background:var(--cobalt);border-color:var(--cobalt);color:#fff}' +
'.an-sec>h2{margin:0;font-size:18px}' +
'.an-sec>.sub{margin:4px 0 14px;color:var(--ink-soft);font-size:13.5px}' +
'.an-card{background:var(--white,#0F1527);border:1px solid var(--line);border-radius:16px;padding:18px;min-width:0;position:relative;box-shadow:0 8px 24px rgba(0,0,0,.18)}' +
'.an-card h3{margin:0 0 2px;font-size:15px}' +
'.an-card .sub{margin:0 0 12px;color:var(--ink-soft);font-size:12.5px}' +
'.an-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}' +
'.an-kpi{padding:14px 16px}' +
'.an-kpi .l{font-size:12.5px;color:var(--ink-soft);font-weight:600}' +
'.an-kpi .v{font-size:26px;font-weight:700;margin:4px 0 2px;letter-spacing:-.01em}' +
'.an-kpi .d{font-size:12px;font-weight:600;color:var(--ink-soft)}' +
'.an-kpi .d.up{color:var(--mint)}.an-kpi .d.down{color:#FF8A6B}' +
'.an-kpi svg{display:block;width:100%;height:30px;margin-top:8px}' +
'.an-grid2{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px}' +
'.an-grid2.even{grid-template-columns:repeat(2,minmax(0,1fr))}' +
'.an-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}' +
'.an-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--ink);border-radius:999px;padding:6px 12px;font:600 12.5px inherit;font-family:inherit;cursor:pointer}' +
'.an-chip i{width:10px;height:10px;border-radius:50%;display:inline-block}' +
'.an-chip.off{opacity:.45}.an-chip.off i{background:transparent!important;border:1.5px solid currentColor}' +
'.an-chart{position:relative;width:100%;min-height:230px}' +
'.an-chart svg{display:block;touch-action:pan-y;overflow:visible}' +
'.an-tip{position:absolute;z-index:5;pointer-events:none;background:#0B1020;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:9px 11px;font-size:12.5px;line-height:1.5;box-shadow:0 10px 30px rgba(0,0,0,.45);min-width:120px;max-width:220px}' +
'.an-tip b{display:block;margin-bottom:3px}.an-tip .r{display:flex;justify-content:space-between;gap:12px}.an-tip .r span:first-child{display:inline-flex;align-items:center;gap:6px;color:var(--ink-soft)}' +
'.an-tip i{width:8px;height:8px;border-radius:50%;display:inline-block}.an-tip em{display:block;margin-top:5px;color:var(--cobalt);font-style:normal;font-weight:600}' +
'.an-hint{font-size:12px;color:var(--ink-soft);margin:8px 0 0}' +
'.an-donut{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:16px}' +
'.an-donut svg{width:132px;height:132px}' +
'.an-donut .legend{display:grid;gap:8px;font-size:13.5px;min-width:0}.an-donut .legend div{display:flex;align-items:center;gap:8px}' +
'.an-donut .legend i{width:10px;height:10px;border-radius:3px;display:inline-block}.an-donut .legend b{margin-left:auto;padding-left:14px}' +
'.an-bars{display:grid;gap:10px}' +
'.an-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;background:none;border:0;color:inherit;text-align:left;font:inherit;padding:2px 0;width:100%}' +
'button.an-bar{cursor:pointer;border-radius:10px}button.an-bar:hover .t,button.an-bar:focus-visible .t{background:rgba(255,255,255,.1)}' +
'.an-bar .n{font-size:13.5px;overflow-wrap:anywhere}.an-bar .c{font-weight:700;font-size:13.5px}' +
'.an-bar .t{grid-column:1/-1;height:9px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden}' +
'.an-bar .f{height:100%;border-radius:99px;width:0;transition:width .7s cubic-bezier(.2,.8,.2,1)}' +
'.an-bar .m{grid-column:1/-1;font-size:11.5px;color:var(--ink-soft);margin-top:-1px}' +
'.an-ins{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}' +
'.an-i{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025);font-size:14px;line-height:1.5}' +
'.an-i .ic{font-size:18px;line-height:1.3}.an-i .btn{margin-top:8px}' +
'.an-i.rec{border-color:rgba(61,107,255,.4);background:rgba(61,107,255,.08)}' +
'.an-lock{display:flex;flex-direction:column;gap:6px;align-items:flex-start;border:1px dashed rgba(255,255,255,.2);background:linear-gradient(135deg,rgba(61,107,255,.1),rgba(138,92,246,.08))}' +
'.an-lock .tag{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8FAEFF}' +
'.an-lock p{margin:0;color:var(--ink-soft);font-size:13.5px}' +
'.an-empty{text-align:center;padding:34px 18px}.an-empty h3{font-size:18px;margin:0 0 6px}.an-empty p{margin:0 auto 14px;color:var(--ink-soft);max-width:440px;font-size:14px}' +
'.an-empty .acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}' +
'.an-err{border-color:rgba(255,107,69,.45);color:#FFB19A}' +
'.an-sk{background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.1),rgba(255,255,255,.04));background-size:200% 100%;animation:ansk 1.3s infinite;border-radius:12px}' +
'@keyframes ansk{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
'.an-table{width:100%;border-collapse:collapse;font-size:13.5px}.an-table th,.an-table td{padding:9px 8px;text-align:right;border-bottom:1px solid var(--line)}.an-table th:first-child,.an-table td:first-child{text-align:left}.an-table th{color:var(--ink-soft);font-weight:600;font-size:12px;white-space:nowrap}' +
'.an-table th,.an-table td{padding-left:6px;padding-right:6px}' +
'.an-wrapx{overflow-x:auto;-webkit-overflow-scrolling:touch}' +
'.an-listbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}' +
'.an-listbar input,.an-listbar select{background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--ink);border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;color-scheme:dark;min-width:0}' +
'.an-listbar input{flex:1 1 180px}' +
'.an-drillbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;margin-bottom:12px;border-radius:12px;background:rgba(61,107,255,.12);border:1px solid rgba(61,107,255,.35);font-size:13.5px}' +
'.an-drillbar b{flex:1 1 auto}' +
'.an-rows{display:grid;gap:10px}' +
'.an-row{display:block;width:100%;text-align:left;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:14px;padding:12px 14px;color:inherit;font:inherit;cursor:pointer}' +
'.an-row:hover,.an-row:focus-visible{border-color:rgba(61,107,255,.6)}' +
'.an-row .top{display:flex;gap:10px;justify-content:space-between;align-items:baseline}' +
'.an-row .nm{font-weight:700;font-size:14.5px;overflow-wrap:anywhere}.an-row .em{font-size:12px;color:var(--ink-soft);overflow-wrap:anywhere}' +
'.an-row .tm{font-size:12px;color:var(--ink-soft);white-space:nowrap}' +
'.an-row .q,.an-row .a{font-size:13.5px;margin-top:7px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
'.an-row .a{color:var(--ink-soft)}.an-row .q b,.an-row .a b{font-weight:700;color:var(--ink);margin-right:4px}' +
'.an-row .meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;align-items:center;font-size:12px;color:var(--ink-soft)}' +
'.an-b{display:inline-block;border-radius:99px;padding:2px 9px;font-size:11.5px;font-weight:700;background:rgba(255,255,255,.08)}.an-b.warn{background:rgba(255,107,69,.18);color:#FF9C7C}.an-b.ok{background:rgba(34,196,147,.16);color:#6FE3BE}' +
'.an-more{display:flex;justify-content:center;margin-top:12px}' +
'.an-sheet{position:fixed;inset:0;z-index:10050;background:rgba(3,6,14,.72);display:flex;align-items:stretch;justify-content:center}' +
'.an-sheet .panel{background:#0B1020;width:100%;max-width:560px;display:flex;flex-direction:column;min-height:0}' +
'@media(min-width:700px){.an-sheet{align-items:center}.an-sheet .panel{height:min(86vh,760px);border-radius:18px;border:1px solid var(--line);overflow:hidden}}' +
'.an-sheet .ph{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}.an-sheet .ph .w{flex:1;min-width:0}' +
'.an-sheet .ph b{display:block;font-size:16px;overflow-wrap:anywhere}.an-sheet .ph span{font-size:12.5px;color:var(--ink-soft);overflow-wrap:anywhere}' +
'.an-sheet .ph button{border:0;background:rgba(255,255,255,.08);color:var(--ink);width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;flex:none}' +
'.an-sheet .pm{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;border-bottom:1px solid var(--line)}' +
'.an-sheet .pb{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:10px;background:#0D1326}' +
'.an-msg{max-width:82%;padding:9px 13px;border-radius:18px;font-size:14.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}' +
'.an-msg.c{align-self:flex-start;background:rgba(255,255,255,.09);border-bottom-left-radius:5px}' +
'.an-msg.a{align-self:flex-end;background:var(--cobalt);color:#fff;border-bottom-right-radius:5px}' +
'.an-msg.a.un{background:#8A3B2B}' +
'.an-msg small{display:block;font-size:10.5px;opacity:.75;margin-top:4px}' +
'.an-who{font-size:11px;color:var(--ink-soft);margin:0 6px -4px}.an-who.r{align-self:flex-end}' +
'@media(max-width:720px){.an-ins{grid-template-columns:minmax(0,1fr)}}' +
'@media(max-width:360px){.an-donut{grid-template-columns:minmax(0,1fr);justify-items:center}}' +
'@media(max-width:860px){.an-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.an-grid2,.an-grid2.even{grid-template-columns:minmax(0,1fr)}}' +
'@media(max-width:520px){.an-nav{margin:0 -12px 6px;padding:8px 12px}.an-head h1{font-size:24px}.an-card{padding:14px}.an-kpi .v{font-size:22px}.an-seg{width:100%}.an-seg button{flex:1;padding:8px 6px;font-size:12.5px}}' +
'@media(prefers-reduced-motion:reduce){.an-bar .f{transition:none}.an-sk{animation:none}}';
    document.head.appendChild(st);
  }

  /* ---------- small chart pieces ---------- */
  function spark(vals, color) {
    var n = vals.length; if (n < 2 || Math.max.apply(null, vals) === 0) return '';
    var w = 120, h = 30, max = Math.max.apply(null, vals), pts = vals.map(function (v, i) { return (i / (n - 1)) * w + ',' + (h - 3 - (v / max) * (h - 8)); });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function smooth(p) {
    if (p.length < 3) return 'M' + p.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join('L');
    var d = 'M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1);
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ',' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ',' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  }

  /* Interactive line/area chart with tooltips (hover or tap), dual axis and previous-period overlay */
  var gid = 0;
  function lineChart(el, cfg) {
    if (!el) return;
    var W = Math.max(260, el.clientWidth), H = W < 480 ? 230 : 300;
    var dual = cfg.series.length > 1 && cfg.dual;
    var m = { l: 38, r: dual ? 40 : 12, t: 12, b: 26 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b, n = cfg.x.length;
    function sx(i) { return n <= 1 ? m.l + iw / 2 : m.l + (i / (n - 1)) * iw; }
    var axes = { l: [], r: [] };
    cfg.series.forEach(function (s) { var a = dual && s.axis === 'r' ? 'r' : 'l'; axes[a] = axes[a].concat(s.values, s.prev || []); });
    function scl(vals) { var mx = Math.max.apply(null, [1].concat(vals.filter(function (v) { return v != null; }))); var st = niceStep(mx / 4); return { top: Math.ceil(mx / st) * st, st: st }; }
    var sc = { l: scl(axes.l), r: scl(axes.r) };
    function sy(v, a) { var s = sc[a]; return m.t + ih - (v / s.top) * ih; }
    var id = 'g' + (++gid), out = '';
    out += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + cfg.series[0].color + '" stop-opacity=".35"/><stop offset="1" stop-color="' + cfg.series[0].color + '" stop-opacity="0"/></linearGradient></defs>';
    for (var g = 0; g * sc.l.st <= sc.l.top + 0.001; g++) {
      var yy = sy(g * sc.l.st, 'l');
      out += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + yy + '" y2="' + yy + '" stroke="rgba(255,255,255,.07)"/>';
      out += '<text x="' + (m.l - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11" fill="' + (dual ? cfg.series[0].color : '#9AA5C0') + '">' + fmt(g * sc.l.st) + '</text>';
      if (dual) { var v2 = (g / (sc.l.top / sc.l.st)) * sc.r.top; out += '<text x="' + (W - m.r + 8) + '" y="' + (yy + 4) + '" font-size="11" fill="' + cfg.series[1].color + '">' + fmt(Math.round(v2)) + '</text>'; }
    }
    var k = Math.max(2, Math.min(n, Math.floor(iw / 72))), last = -1;
    for (var t = 0; t < k; t++) {
      var ix = n <= 1 ? 0 : Math.round((t / (k - 1)) * (n - 1)); if (ix === last) continue; last = ix;
      out += '<text x="' + sx(ix) + '" y="' + (H - 6) + '" text-anchor="' + (t === 0 ? 'start' : t === k - 1 ? 'end' : 'middle') + '" font-size="11" fill="#9AA5C0">' + esc(cfg.xlabel(cfg.x[ix])) + '</text>';
    }
    cfg.series.forEach(function (s, si) {
      var a = dual && s.axis === 'r' ? 'r' : 'l';
      if (s.prev && cfg.compare) {
        var pp = s.prev.map(function (v, i) { return [sx(i), sy(v, a)]; });
        out += '<path d="' + smooth(pp) + '" fill="none" stroke="' + s.color + '" stroke-opacity=".4" stroke-width="2" stroke-dasharray="5 5"/>';
      }
      var pts = s.values.map(function (v, i) { return [sx(i), sy(v, a)]; });
      if (n > 1) {
        var path = smooth(pts);
        if (si === 0) out += '<path d="' + path + ' L' + sx(n - 1) + ',' + (m.t + ih) + ' L' + sx(0) + ',' + (m.t + ih) + ' Z" fill="url(#' + id + ')"/>';
        out += '<path class="an-line" d="' + path + '" fill="none" stroke="' + s.color + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="transition:stroke-dashoffset .9s ease"/>';
      }
      if (n <= 40) pts.forEach(function (p) { out += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.6" fill="' + s.color + '"/>'; });
    });
    out += '<line id="' + id + 'v" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3" visibility="hidden"/>';
    cfg.series.forEach(function (s, si) { out += '<circle id="' + id + 'd' + si + '" r="5" fill="' + s.color + '" stroke="#0F1527" stroke-width="2" visibility="hidden"/>'; });
    out += '<rect id="' + id + 'o" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="transparent" style="cursor:' + (cfg.onPick ? 'pointer' : 'default') + '"/>';
    el.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.label) + '">' + out + '</svg><div class="an-tip" id="' + id + 't" style="display:none"></div>';
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.querySelectorAll('.an-line').forEach(function (p) { p.style.strokeDashoffset = '0'; }); }); });

    var ov = $(id + 'o'), tip = $(id + 't'), guide = $(id + 'v'), last2 = -1, touchPin = -1;
    function idxAt(e) { var r = ov.getBoundingClientRect(); var f = (e.clientX - r.left) / Math.max(1, r.width); return Math.max(0, Math.min(n - 1, n <= 1 ? 0 : Math.round(f * (n - 1)))); }
    function show(i) {
      last2 = i; guide.setAttribute('x1', sx(i)); guide.setAttribute('x2', sx(i)); guide.setAttribute('visibility', 'visible');
      var rows = '';
      cfg.series.forEach(function (s, si) {
        var a = dual && s.axis === 'r' ? 'r' : 'l', d = $(id + 'd' + si); d.setAttribute('cx', sx(i)); d.setAttribute('cy', sy(s.values[i], a)); d.setAttribute('visibility', 'visible');
        rows += '<div class="r"><span><i style="background:' + s.color + '"></i>' + esc(s.label) + '</span><b>' + fmt(s.values[i]) + '</b></div>';
        if (s.prev && cfg.compare && s.prev[i] != null) rows += '<div class="r" style="opacity:.7"><span>&nbsp;&nbsp;previous</span><span>' + fmt(s.prev[i]) + '</span></div>';
      });
      tip.innerHTML = '<b>' + esc(cfg.tipTitle(cfg.x[i])) + '</b>' + rows + (cfg.onPick ? '<em>Tap again to see these conversations</em>' : '');
      tip.style.display = 'block';
      var tw = tip.offsetWidth, x = sx(i) + 12; if (x + tw > W) x = sx(i) - tw - 12; tip.style.left = Math.max(0, x) + 'px'; tip.style.top = '6px';
    }
    function hide() { guide.setAttribute('visibility', 'hidden'); tip.style.display = 'none'; cfg.series.forEach(function (s, si) { $(id + 'd' + si).setAttribute('visibility', 'hidden'); }); last2 = -1; }
    ov.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch') show(idxAt(e)); });
    ov.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch' && touchPin < 0) hide(); });
    ov.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') show(idxAt(e)); });
    ov.addEventListener('click', function (e) {
      var i = idxAt(e), touch = e.pointerType === 'touch' || (e.detail === 0 && !e.pointerType) || window.matchMedia('(hover: none)').matches;
      if (touch && touchPin !== i) { touchPin = i; show(i); return; }
      touchPin = -1; if (cfg.onPick) cfg.onPick(i);
    });
  }

  function donut(a, u) {
    var t = a + u, R = 56, C = 2 * Math.PI * R, pa = t ? a / t : 0, r = rate(a, u);
    return '<svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="Answered ' + fmt(a) + ', unanswered ' + fmt(u) + '">' +
      '<circle cx="75" cy="75" r="' + R + '" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="16"/>' +
      (t ? '<circle cx="75" cy="75" r="' + R + '" fill="none" stroke="#FF8A6B" stroke-width="16"/>' +
        '<circle cx="75" cy="75" r="' + R + '" fill="none" stroke="#22C493" stroke-width="16" stroke-linecap="butt" stroke-dasharray="' + (C * pa) + ' ' + C + '" transform="rotate(-90 75 75)"/>' : '') +
      '<text x="75" y="76" text-anchor="middle" font-size="26" font-weight="700" fill="#EEF2FF">' + (r == null ? '-' : r.toFixed(r >= 99.95 ? 0 : 1) + '%') + '</text>' +
      '<text x="75" y="96" text-anchor="middle" font-size="11" fill="#9AA5C0">answered</text></svg>';
  }

  function hbars(items, color, onclick, kind) {
    var max = Math.max.apply(null, [1].concat(items.map(function (i) { return i.v; })));
    return '<div class="an-bars">' + items.map(function (it, i) {
      var tag = onclick ? 'button type="button"' : 'div', end = onclick ? 'button' : 'div';
      return '<' + tag + ' class="an-bar"' + (onclick ? ' data-i="' + i + '" data-kind="' + (kind || '') + '"' : '') + '><span class="n">' + esc(it.n) + '</span><span class="c">' + fmt(it.v) + '</span><span class="t"><span class="f" style="display:block;background:' + color + '" data-w="' + Math.max(3, (it.v / max) * 100) + '"></span></span>' + (it.m ? '<span class="m">' + esc(it.m) + '</span>' : '') + '</' + end + '>';
    }).join('') + '</div>';
  }
  function animateBars(scope) { requestAnimationFrame(function () { requestAnimationFrame(function () { (scope || document).querySelectorAll('.an-bar .f').forEach(function (f) { f.style.width = f.dataset.w + '%'; }); }); }); }

  function heatmap(el, heat) {
    if (!el) return;
    var W = Math.max(280, el.clientWidth), lw = 34, cell = Math.floor((W - lw) / 24), gap = cell > 14 ? 3 : 2, H = 7 * cell + 22;
    var grid = {}, max = 0;
    heat.forEach(function (h) { grid[h.dow + '-' + h.hour] = num(h.n); max = Math.max(max, num(h.n)); });
    var order = [1, 2, 3, 4, 5, 6, 0], out = '';
    order.forEach(function (d, r) {
      out += '<text x="0" y="' + (r * cell + cell / 2 + 4) + '" font-size="11" fill="#9AA5C0">' + DOW[d] + '</text>';
      for (var h = 0; h < 24; h++) {
        var n = grid[d + '-' + h] || 0;
        out += '<rect x="' + (lw + h * cell) + '" y="' + (r * cell) + '" width="' + (cell - gap) + '" height="' + (cell - gap) + '" rx="3" fill="' + (n ? '#3D6BFF' : '#fff') + '" fill-opacity="' + (n ? (0.15 + 0.85 * (n / max)).toFixed(2) : '0.05') + '" data-d="' + d + '" data-h="' + h + '" data-n="' + n + '" style="cursor:pointer"><title>' + DOW_LONG[d] + ' ' + hourLabel(h) + ': ' + n + ' customer messages</title></rect>';
      }
    });
    [0, 6, 12, 18].forEach(function (h) { out += '<text x="' + (lw + h * cell) + '" y="' + (H - 4) + '" font-size="10.5" fill="#9AA5C0">' + hourLabel(h) + '</text>'; });
    el.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Customer messages by day and hour">' + out + '</svg><p class="an-hint" id="anHeatCap">Tap a square to see the exact number.</p>';
    el.querySelectorAll('rect').forEach(function (r) {
      r.addEventListener('click', function () { var c = $('anHeatCap'); if (c) c.textContent = DOW_LONG[+r.dataset.d] + ' at ' + hourLabel(+r.dataset.h) + ': ' + r.dataset.n + ' customer message' + (r.dataset.n === '1' ? '' : 's'); });
    });
  }

  function multiLine(el, x, series) {
    if (!el) return;
    var W = Math.max(260, el.clientWidth), H = W < 480 ? 210 : 250, m = { l: 34, r: 10, t: 10, b: 24 }, iw = W - m.l - m.r, ih = H - m.t - m.b, n = x.length;
    var mx = Math.max.apply(null, [1].concat(series.reduce(function (a, s) { return a.concat(s.values); }, []))), st = niceStep(mx / 4), top = Math.ceil(mx / st) * st;
    function sx(i) { return n <= 1 ? m.l + iw / 2 : m.l + (i / (n - 1)) * iw; } function sy(v) { return m.t + ih - (v / top) * ih; }
    var out = '';
    for (var g = 0; g * st <= top + .001; g++) out += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + sy(g * st) + '" y2="' + sy(g * st) + '" stroke="rgba(255,255,255,.07)"/><text x="' + (m.l - 7) + '" y="' + (sy(g * st) + 4) + '" text-anchor="end" font-size="11" fill="#9AA5C0">' + fmt(g * st) + '</text>';
    out += '<text x="' + m.l + '" y="' + (H - 6) + '" font-size="11" fill="#9AA5C0">' + esc(shortDate(x[0])) + '</text><text x="' + (W - m.r) + '" y="' + (H - 6) + '" text-anchor="end" font-size="11" fill="#9AA5C0">' + esc(shortDate(x[n - 1])) + '</text>';
    series.forEach(function (s) { out += '<path d="' + smooth(s.values.map(function (v, i) { return [sx(i), sy(v)]; })) + '" fill="none" stroke="' + s.color + '" stroke-width="2.4" stroke-linecap="round"/>'; });
    el.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Product clicks over time">' + out + '</svg>' +
      '<div class="an-tools" style="margin-top:8px">' + series.map(function (s) { return '<span class="an-chip" style="cursor:default"><i style="background:' + s.color + '"></i>' + esc(s.label) + '</span>'; }).join('') + '</div>';
  }

  /* ---------- sections ---------- */
  function lock(title, plan, text) {
    return '<div class="an-card an-lock"><span class="tag">' + esc(plan) + ' and above</span><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><button type="button" class="btn btn-primary btn-sm" style="margin-top:8px" onclick="showView(\'subscription\')">See plans</button></div>';
  }
  function skeleton() {
    return '<div class="an-kpis">' + [1, 2, 3, 4].map(function () { return '<div class="an-card an-sk" style="height:112px"></div>'; }).join('') + '</div>' +
      '<div class="an-card an-sk" style="height:380px;margin-top:30px"></div>' +
      '<div class="an-grid2 even" style="margin-top:30px"><div class="an-card an-sk" style="height:240px"></div><div class="an-card an-sk" style="height:240px"></div></div>';
  }

  function controls() {
    var r = rank(), items = [['today', 'Today'], ['7d', '7 Days'], ['30d', '30 Days'], ['90d', '90 Days'], ['custom', 'Custom']];
    return '<div class="an-head"><div><h1>Analytics</h1><p>Track your AI\'s performance, customer activity, conversations, and product engagement.</p></div>' +
      '<div class="an-ctrl"><div class="an-seg" role="group" aria-label="Date range">' + items.map(function (i) {
        var dis = i[0] === 'custom' && r < 2;
        return '<button type="button" data-range="' + i[0] + '" class="' + (S.range === i[0] ? 'on' : '') + '"' + (dis ? ' disabled title="Standard and above"' : '') + '>' + i[1] + '</button>';
      }).join('') + '</div></div></div>' +
      (S.range === 'custom' && r >= 2 ? '<div class="an-custom"><input type="date" id="anFrom" value="' + esc(S.custom.from) + '" aria-label="From"><span style="color:var(--ink-soft)">to</span><input type="date" id="anTo" value="' + esc(S.custom.to) + '" aria-label="To"><button type="button" class="btn btn-primary btn-sm" id="anApply">Apply</button></div>' : '');
  }

  var TABS = [['overview', 'Overview'], ['activity', 'Activity'], ['ai', 'AI performance'], ['products', 'Products'], ['insights', 'Insights'], ['conv', 'Conversations'], ['advanced', 'Advanced']];
  function navHtml() {
    return '<nav class="an-nav" role="tablist" aria-label="Analytics sections">' + TABS.map(function (i) {
      return '<a role="tab" tabindex="0" data-tab="' + i[0] + '" aria-selected="' + (S.tab === i[0]) + '"' + (S.tab === i[0] ? ' class="on"' : '') + '>' + i[1] + '</a>';
    }).join('') + '</nav>';
  }

  function kpiHtml(d) {
    var c = d.cur, p = d.prev, hp = hasPrev(d), days = d.daily || [];
    function delta(cv, pv, isRate) {
      if (!hp) return '<span class="d">No previous data</span>';
      if (isRate) { if (cv == null || pv == null) return '<span class="d">-</span>'; var diff = cv - pv; return '<span class="d ' + (diff >= 0 ? 'up' : 'down') + '">' + (diff >= 0 ? '&uarr; ' : '&darr; ') + Math.abs(diff).toFixed(1) + ' pts</span>'; }
      var x = pct(cv, pv); if (x == null) return '<span class="d">No previous data</span>';
      return '<span class="d ' + (x >= 0 ? 'up' : 'down') + '">' + (x >= 0 ? '&uarr; ' : '&darr; ') + Math.abs(x).toFixed(1) + '% vs previous</span>';
    }
    var ar = rate(c.answered, c.unanswered), pr = rate(p.answered, p.unanswered);
    var answerSeries = days.map(function (x) { var r = rate(x.answered, x.unanswered); return r == null ? 0 : r; });
    var cards = [
      ['Conversations', fmt(c.conversations), delta(c.conversations, p.conversations), spark(days.map(function (x) { return num(x.conversations); }), '#3D6BFF')],
      ['Messages', fmt(c.messages), delta(c.messages, p.messages), spark(days.map(function (x) { return num(x.messages); }), '#22C493')],
      ['Product clicks', fmt(c.clicks), delta(c.clicks, p.clicks), spark(days.map(function (x) { return num(x.clicks); }), '#FF6B45')],
      ['AI answer rate', ar == null ? '-' : ar.toFixed(1) + '%', ar == null ? '<span class="d">Tracking starts with new chats</span>' : delta(ar, pr, true), spark(answerSeries, '#8FAEFF')]
    ];
    return '<div class="an-kpis">' + cards.map(function (k) { return '<div class="an-card an-kpi"><div class="l">' + k[0] + '</div><div class="v">' + k[1] + '</div>' + k[2] + k[3] + '</div>'; }).join('') + '</div>';
  }

  function mainHtml(d) {
    var r = rank(), cmp = r >= 2 && hasPrev(d) && (d.daily || []).length > 1;
    return '<section class="an-sec" id="an-s-overview"><h2>Conversation performance</h2><p class="sub">Are conversations and messages going up or down?</p><div class="an-card">' +
      '<div class="an-tools"><button type="button" class="an-chip ' + (S.showConv ? '' : 'off') + '" data-tog="conv" style="color:#8FAEFF"><i style="background:#3D6BFF"></i>Conversations</button>' +
      '<button type="button" class="an-chip ' + (S.showMsg ? '' : 'off') + '" data-tog="msg" style="color:#6FE3BE"><i style="background:#22C493"></i>Messages</button>' +
      (cmp ? '<button type="button" class="an-chip ' + (S.compare ? '' : 'off') + '" data-tog="cmp"><i style="background:#9AA5C0"></i>Previous period</button>' : (r >= 2 ? '' : '<span class="an-hint" style="margin:0">Compare with the previous period on Standard</span>')) + '</div>' +
      '<div class="an-chart" id="anMain"></div>' +
      '<p class="an-hint">' + (r >= 2 ? 'Tap a point to see that day\'s conversations.' : 'Upgrade to Standard to open a day\'s conversations from this chart.') + '</p></div></section>';
  }

  function activityHtml(d) {
    if (rank() < 2) return '<section class="an-sec"><h2>Customer activity</h2><p class="sub">When do customers talk to Auvii?</p>' + lock('Busiest days and hours', 'Standard', 'See which days and hours customers write the most, so you know when your store needs attention.') + '</section>';
    var heat = d.heat || [], tot = sum(heat.map(function (h) { return num(h.n); }));
    if (!tot) return '<section class="an-sec"><h2>Customer activity</h2><p class="sub">When do customers talk to Auvii?</p><div class="an-card"><p class="an-hint" style="margin:0">No customer messages in this period yet.</p></div></section>';
    var byDow = [0, 0, 0, 0, 0, 0, 0]; heat.forEach(function (h) { byDow[h.dow] += num(h.n); });
    var items = [1, 2, 3, 4, 5, 6, 0].map(function (x) { return { n: DOW_LONG[x], v: byDow[x] }; });
    return '<section class="an-sec" id="an-s-activity"><h2>Customer activity</h2><p class="sub">Customer messages by day and by hour (' + esc(TZ) + ').</p><div class="an-grid2"><div class="an-card"><h3>Busiest days</h3><p class="sub">Customer messages per weekday</p>' + hbars(items, '#3D6BFF') + '</div>' +
      '<div class="an-card"><h3>Busiest hours</h3><p class="sub">Darker means more messages</p><div id="anHeat"></div></div></div></section>';
  }

  function aiHtml(d) {
    var c = d.cur, a = num(c.answered), u = num(c.unanswered), tracked = a + u, days = d.daily || [], r = rank(), av = d.averages || {};
    var trend = r >= 2 && days.filter(function (x) { return num(x.answered) + num(x.unanswered) > 0; }).length > 1;
    var legend = '<div class="legend"><div><i style="background:#22C493"></i>Answered<b>' + fmt(a) + '</b></div><div><i style="background:#FF8A6B"></i>Unanswered<b>' + fmt(u) + '</b></div>' +
      '<div style="color:var(--ink-soft);font-size:12.5px;display:block">Avg. messages per conversation: <b style="margin:0;color:var(--ink)">' + (av.avg_messages != null ? av.avg_messages : '-') + '</b>' +
      (r >= 2 ? '<br>Avg. conversation length: <b style="margin:0;color:var(--ink)">' + dur(av.avg_seconds) + '</b>' : '') + '</div></div>';
    var note = tracked === 0 ? '<p class="an-hint">Auvii started recording whether it answered with new chats. Nothing has been recorded in this period yet.</p>' :
      (d.tracking_started ? '<p class="an-hint">Based on ' + fmt(tracked) + ' replies recorded since ' + esc(longDate(String(d.tracking_started).slice(0, 10))) + '. Earlier replies were not recorded.</p>' : '');
    var left = '<div class="an-card"><h3>Answered vs unanswered</h3><p class="sub">How well is Auvii answering customers?</p><div class="an-donut">' + donut(a, u) + legend + '</div>' + note + '</div>';
    var right = trend ? '<div class="an-card"><h3>Answer rate over time</h3><p class="sub">Is Auvii getting better?</p><div class="an-chart" id="anRate" style="min-height:200px"></div></div>' :
      (r >= 2 ? '<div class="an-card"><h3>Answer rate over time</h3><p class="sub">Is Auvii getting better?</p><p class="an-hint">Not enough recorded days yet. Keep using Auvii to build this trend.</p></div>' : lock('Answer rate over time', 'Standard', 'Track whether Auvii is improving or getting worse day by day.'));
    return '<section class="an-sec" id="an-s-ai"><h2>AI performance</h2><p class="sub">How well is your assistant answering?</p><div class="an-grid2 even">' + left + right + '</div></section>';
  }

  function productsHtml(d) {
    var list = d.products || [], r = rank(), tc = num(d.cur.clicks);
    var body;
    if (!list.length) body = '<p class="an-hint" style="margin:0">No product clicks in this period yet. Clicks appear when customers tap "View Product" in a chat.</p>';
    else body = hbars(list.map(function (p) { return { n: p.name, v: num(p.clicks), m: (tc ? Math.round((num(p.clicks) / tc) * 100) + '% of clicks' : '') + (num(p.conversations) ? ' - ' + p.conversations + ' conversation' + (num(p.conversations) === 1 ? '' : 's') : '') }; }), '#FF6B45', r >= 2, 'product');
    return '<section class="an-sec" id="an-s-products"><h2>Product performance</h2><p class="sub">Which products are customers interested in?</p><div class="an-card"><h3>Most clicked products</h3><p class="sub">' + (r >= 2 ? 'Tap a product to see the conversations where it was clicked.' : 'Clicks on "View Product" cards inside chats.') + '</p>' + body + '</div></section>';
  }

  function insightsHtml(d) {
    var c = d.cur, p = d.prev, r = rank(), out = [], x;
    var cx = pct(c.conversations, p.conversations);
    if (hasPrev(d) && cx != null && Math.abs(cx) >= 1) out.push(['&#128161;', 'Conversations ' + (cx >= 0 ? 'increased ' : 'decreased ') + Math.abs(cx).toFixed(0) + '% compared with the previous period (' + fmt(p.conversations) + ' to ' + fmt(c.conversations) + ').']);
    var u = num(c.unanswered), t = u + num(c.answered);
    if (u > 0) out.push(['&#9888;&#65039;', fmt(u) + ' customer question' + (u === 1 ? ' was' : 's were') + ' unanswered (' + Math.round((u / t) * 100) + '% of the replies recorded).']);
    var q = (d.questions || [])[0];
    if (q && r >= 2) out.push(['&#128218;', '"' + q.question + '" was the most common unanswered question (' + q.count + ' conversation' + (num(q.count) === 1 ? '' : 's') + ').']);
    var pr = (d.products || [])[0];
    if (pr && num(c.clicks)) out.push(['&#128717;&#65039;', 'Your most clicked product was ' + pr.name + ' (' + fmt(pr.clicks) + ' click' + (num(pr.clicks) === 1 ? '' : 's') + ', ' + Math.round((num(pr.clicks) / num(c.clicks)) * 100) + '% of all clicks).']);
    var heat = d.heat || [], tot = sum(heat.map(function (h) { return num(h.n); }));
    if (r >= 2 && tot >= 20) {
      var bd = [0, 0, 0, 0, 0, 0, 0], bh = {}; heat.forEach(function (h) { bd[h.dow] += num(h.n); bh[h.hour] = (bh[h.hour] || 0) + num(h.n); });
      var di = bd.indexOf(Math.max.apply(null, bd)), hh = Object.keys(bh).sort(function (a, b) { return bh[b] - bh[a]; })[0];
      out.push(['&#128337;', 'Customers write most on ' + DOW_LONG[di] + 's, with the busiest hour around ' + hourLabel(+hh) + '.']);
    }
    var v = d.visitors;
    if (r >= 2 && v && num(v.returning) > 0) out.push(['&#128260;', fmt(v.returning) + ' of ' + fmt(num(v.returning) + num(v['new'])) + ' recognised visitors were returning customers.']);
    var list = out.length ? '<div class="an-ins">' + out.map(function (i) { return '<div class="an-i"><span class="ic">' + i[0] + '</span><div>' + esc(i[1]) + '</div></div>'; }).join('') + '</div>' :
      '<div class="an-card"><p class="an-hint" style="margin:0">Not enough data for insights yet. They appear automatically as customers chat with Auvii.</p></div>';
    var qs = '';
    if (r >= 2) {
      var ql = d.questions || [];
      qs = '<div class="an-card" style="margin-top:14px"><h3>Unanswered questions</h3><p class="sub">What is Auvii failing to answer? Tap one to see the conversations.</p>' +
        (ql.length ? hbars(ql.map(function (z) { return { n: z.question, v: num(z.count), m: 'Last asked ' + ago(z.last_at) }; }), '#FF8A6B', true, 'question') : '<p class="an-hint" style="margin:0">No unanswered questions in this period.</p>') + '</div>';
    } else qs = '<div style="margin-top:14px">' + lock('Unanswered questions ranking', 'Standard', 'See the questions Auvii could not answer, ranked, and open the conversations behind each one.') + '</div>';
    return '<section class="an-sec" id="an-s-insights"><h2>Conversation insights</h2><p class="sub">What the data says, in plain words.</p>' + list + qs + '</section>';
  }

  function advancedHtml(d) {
    var r = rank();
    if (r < 3) return '<section class="an-sec" id="an-s-advanced"><h2>Advanced insights</h2><p class="sub">What it means and what to do next.</p>' + lock('Recommendations, comparisons and product trends', 'Premium', 'Get recommendations based on your own data, a full period comparison and product engagement trends.') + '</section>';
    var c = d.cur, p = d.prev, recs = [], q = (d.questions || [])[0];
    if (q && num(q.count) >= 2) recs.push('Customers asked "' + q.question + '" in ' + q.count + ' conversations and Auvii could not answer. Add this to your training so it can answer next time.');
    var ar = rate(c.answered, c.unanswered), pr = rate(p.answered, p.unanswered);
    if (ar != null && pr != null && num(p.answered) + num(p.unanswered) >= 10 && pr - ar >= 5) recs.push('Your answer rate fell from ' + pr.toFixed(0) + '% to ' + ar.toFixed(0) + '%. Review the unanswered questions above and add what is missing.');
    if (num(c.conversations) >= 20 && (d.products || []).length && num(c.clicks) / num(c.conversations) < 0.05) recs.push('Only ' + (num(c.clicks) / num(c.conversations) * 100).toFixed(1) + ' product clicks per 100 conversations. Check that your product names, descriptions and images are clear.');
    var v = d.visitors; if (v && num(v.unknown) > num(v['new']) + num(v.returning) && num(v.unknown) >= 10) recs.push('Most visitors cannot be recognised because they did not leave an email. Keep "Ask visitors for their name and email" switched on in Connect.');
    var recHtml = recs.length ? '<div class="an-ins">' + recs.map(function (t) { return '<div class="an-i rec"><span class="ic">&#127919;</span><div>' + esc(t) + (/training/.test(t) ? '<br><button type="button" class="btn btn-ghost btn-sm" onclick="showView(\'training\')">Open Training</button>' : '') + '</div></div>'; }).join('') + '</div>' :
      '<div class="an-card"><p class="an-hint" style="margin:0">No recommendations right now. They appear when your data shows something worth acting on.</p></div>';
    var tracked = num(c.answered) + num(c.unanswered) + num(p.answered) + num(p.unanswered) > 0;
    function row(l, a, b, rec) { if (rec && !tracked) return '<tr><td>' + l + '</td><td colspan="3" style="color:var(--ink-soft)">Not recorded yet</td></tr>'; var x = pct(a, b); return '<tr><td>' + l + '</td><td>' + fmt(a) + '</td><td>' + fmt(b) + '</td><td>' + (hasPrev(d) && x != null ? (x >= 0 ? '+' : '') + x.toFixed(1) + '%' : '-') + '</td></tr>'; }
    var tbl = '<div class="an-card" style="margin-top:14px"><h3>Period comparison</h3><p class="sub">This period against the one just before it</p><div class="an-wrapx"><table class="an-table"><thead><tr><th>Metric</th><th>This period</th><th>Previous</th><th>Change</th></tr></thead><tbody>' +
      row('Conversations', c.conversations, p.conversations) + row('Messages', c.messages, p.messages) + row('Customer messages', c.customer_messages, p.customer_messages) + row('Product clicks', c.clicks, p.clicks) + row('Answered replies', c.answered, p.answered, true) + row('Unanswered replies', c.unanswered, p.unanswered, true) + '</tbody></table></div></div>';
    var trendCard = (d.products || []).length && (d.daily || []).length > 1 ? '<div class="an-card" style="margin-top:14px"><h3>Product engagement over time</h3><p class="sub">Daily clicks for your top products</p><div class="an-chart" id="anProdTrend" style="min-height:200px"></div></div>' : '';
    return '<section class="an-sec" id="an-s-advanced"><h2>Advanced insights</h2><p class="sub">What it means and what to do next.</p>' + recHtml + tbl + trendCard + '</section>';
  }

  function listShell() {
    var drill = S.drill ? '<div class="an-drillbar"><b>' + esc(S.drill.label) + '</b><button type="button" class="btn btn-ghost btn-sm" id="anClearDrill">Clear</button></div>' : '';
    return '<section class="an-sec" id="anConvSec"><h2>Conversations</h2><p class="sub">Every chat between your customers and Auvii.</p><div class="an-card">' + drill +
      '<div class="an-listbar"><input type="search" id="anSearch" placeholder="Search by name or email" value="' + esc(S.search) + '" aria-label="Search conversations">' +
      '<select id="anFilter" aria-label="Filter"><option value="all"' + (S.filter === 'all' ? ' selected' : '') + '>All</option><option value="answered"' + (S.filter === 'answered' ? ' selected' : '') + '>Fully answered</option><option value="unanswered"' + (S.filter === 'unanswered' ? ' selected' : '') + '>Has unanswered</option></select>' +
      '<select id="anSort" aria-label="Sort"><option value="newest"' + (S.sort === 'newest' ? ' selected' : '') + '>Newest</option><option value="oldest"' + (S.sort === 'oldest' ? ' selected' : '') + '>Oldest</option></select></div>' +
      '<div id="anList"></div></div></section>';
  }

  function rowHtml(c) {
    var nm = c.customer_name || c.customer_email || 'Anonymous visitor', un = num(c.unanswered);
    return '<button type="button" class="an-row" data-id="' + esc(c.id) + '"><div class="top"><div><div class="nm">' + esc(nm) + '</div>' + (c.customer_name && c.customer_email ? '<div class="em">' + esc(c.customer_email) + '</div>' : '') + '</div><div class="tm" title="' + esc(c.last_message_at) + '">' + esc(ago(c.last_message_at)) + '</div></div>' +
      (c.last_customer ? '<div class="q"><b>Customer</b>' + esc(c.last_customer) + '</div>' : '') + (c.last_ai ? '<div class="a"><b>Auvii</b>' + esc(c.last_ai) + '</div>' : '') +
      '<div class="meta"><span>' + fmt(c.msg_count) + ' message' + (num(c.msg_count) === 1 ? '' : 's') + '</span>' + (num(c.clicks) ? '<span class="an-b">' + c.clicks + ' product click' + (num(c.clicks) === 1 ? '' : 's') + '</span>' : '') + (un ? '<span class="an-b warn">' + un + ' unanswered</span>' : '<span class="an-b ok">Answered</span>') + '<span style="margin-left:auto;color:var(--cobalt);font-weight:600">View conversation &rarr;</span></div></button>';
  }

  function paintList() {
    var box = $('anList'); if (!box) return; var L = S.list, h = '';
    if (L.err) h = '<div class="an-card an-err">Could not load conversations: ' + esc(L.err) + ' <button type="button" class="btn btn-ghost btn-sm" id="anListRetry">Try again</button></div>';
    else if (L.loading && !L.rows.length) h = '<div class="an-rows">' + [1, 2, 3].map(function () { return '<div class="an-sk" style="height:96px"></div>'; }).join('') + '</div>';
    else if (!L.rows.length) h = '<div class="an-empty"><h3>' + (S.search || S.filter !== 'all' || S.drill ? 'No conversations match' : 'No conversations yet') + '</h3><p>' + (S.search || S.filter !== 'all' || S.drill ? 'Try clearing the filters or choosing a longer date range.' : 'Once customers start chatting with your Auvii AI, their conversations will appear here.') + '</p><div class="acts"><button type="button" class="btn btn-primary btn-sm" onclick="showView(\'training\')">Test your AI</button><button type="button" class="btn btn-ghost btn-sm" onclick="showView(\'connect\')">Connect your website</button></div></div>';
    else h = '<p class="an-hint" style="margin:0 0 10px">' + fmt(L.total) + ' conversation' + (L.total === 1 ? '' : 's') + ' found</p><div class="an-rows">' + L.rows.map(rowHtml).join('') + '</div>' +
      (L.rows.length < L.total ? '<div class="an-more"><button type="button" class="btn btn-ghost btn-sm" id="anMore"' + (L.loading ? ' disabled' : '') + '>' + (L.loading ? 'Loading...' : 'Show more (' + (L.total - L.rows.length) + ' left)') + '</button></div>' : '');
    box.innerHTML = h;
    box.querySelectorAll('.an-row').forEach(function (b) { b.addEventListener('click', function () { openConv(b.dataset.id); }); });
    var mo = $('anMore'); if (mo) mo.addEventListener('click', function () { loadList(false); });
    var rt = $('anListRetry'); if (rt) rt.addEventListener('click', function () { loadList(true); });
  }

  function loadList(reset) {
    var id = agentId(); if (!id) return; var L = S.list, tok = ++S.loadToken;
    if (reset) { L.rows = []; L.total = 0; }
    L.loading = true; L.err = ''; paintList();
    var r = rangeDates(), dr = S.drill || {};
    return rpc('auvii_an_conversations', { p_agent: id, p_from: r.from.toISOString(), p_to: r.to.toISOString(), p_tz: TZ, p_search: S.search || null, p_filter: S.filter, p_day: dr.day || null, p_question: dr.question || null, p_product: dr.product || null, p_sort: S.sort, p_limit: 10, p_offset: reset ? 0 : L.rows.length })
      .then(function (d) { if (tok !== S.loadToken) return; L.rows = reset ? (d.rows || []) : L.rows.concat(d.rows || []); L.total = num(d.total); })
      .catch(function (e) { if (tok === S.loadToken) L.err = e.message; })
      .then(function () { if (tok === S.loadToken) { L.loading = false; paintList(); } });
  }

  /* ---------- full conversation view ---------- */
  function closeSheet() { var s = $('anSheet'); if (s) s.remove(); document.documentElement.style.overflow = S.prevOverflow || ''; }
  function openConv(cid) {
    var id = agentId(); if (!id) return;
    closeSheet(); S.prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
    var sh = document.createElement('div'); sh.className = 'an-sheet'; sh.id = 'anSheet';
    sh.innerHTML = '<div class="panel" role="dialog" aria-label="Conversation"><div class="ph"><div class="w"><b>Loading...</b></div><button type="button" id="anSheetX" aria-label="Close">&times;</button></div><div class="pb"><div class="an-sk" style="height:60px;width:70%"></div><div class="an-sk" style="height:60px;width:60%;align-self:flex-end"></div></div></div>';
    document.body.appendChild(sh);
    sh.addEventListener('click', function (e) { if (e.target === sh) closeSheet(); });
    $('anSheetX').addEventListener('click', closeSheet);
    rpc('auvii_an_conversation', { p_agent: id, p_conversation: String(cid) }).then(function (d) {
      var cv = d.conversation || {}, ms = d.messages || [], ck = d.clicks || [];
      var nm = cv.customer_name || cv.customer_email || 'Anonymous visitor', un = ms.filter(function (m) { return m.sender === 'ai' && m.answered === false; }).length;
      var names = []; ck.forEach(function (c) { if (names.indexOf(c.name) < 0) names.push(c.name); });
      var started = cv.created_at ? new Date(cv.created_at) : null;
      var head = '<div class="ph"><div class="w"><b>' + esc(nm) + '</b><span>' + (cv.customer_name && cv.customer_email ? '<a href="mailto:' + esc(cv.customer_email) + '" style="color:var(--cobalt)">' + esc(cv.customer_email) + '</a> - ' : '') + (started ? esc(started.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : '') + '</span></div><button type="button" id="anSheetX" aria-label="Close">&times;</button></div>';
      var meta = '<div class="pm"><span class="an-b">' + ms.length + ' message' + (ms.length === 1 ? '' : 's') + '</span>' + (un ? '<span class="an-b warn">' + un + ' unanswered</span>' : '') + (names.length ? '<span class="an-b">Products clicked: ' + esc(names.join(', ')) + '</span>' : '') + '</div>';
      var body = ms.length ? ms.map(function (m) {
        var ai = m.sender === 'ai', t = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return '<div class="an-who' + (ai ? ' r' : '') + '">' + (ai ? 'Auvii' : esc(nm)) + '</div><div class="an-msg ' + (ai ? 'a' : 'c') + (ai && m.answered === false ? ' un' : '') + '">' + esc(m.content) + '<small>' + esc(t) + (ai && m.answered === false ? ' - could not answer' : '') + '</small></div>';
      }).join('') : '<p class="an-hint">This conversation has no messages yet.</p>';
      sh.innerHTML = '<div class="panel" role="dialog" aria-label="Conversation">' + head + meta + '<div class="pb">' + body + '</div></div>';
      $('anSheetX').addEventListener('click', closeSheet);
      var pb = sh.querySelector('.pb'); if (pb) pb.scrollTop = pb.scrollHeight;
    }).catch(function (e) {
      sh.innerHTML = '<div class="panel"><div class="ph"><div class="w"><b>Could not open this conversation</b><span>' + esc(e.message) + '</span></div><button type="button" id="anSheetX" aria-label="Close">&times;</button></div></div>';
      $('anSheetX').addEventListener('click', closeSheet);
    });
  }

  /* ---------- drill-down ---------- */
  function drillTo(drill) {
    S.drill = drill; S.search = ''; S.filter = 'all'; S.tab = 'conv';
    renderAll(true);
    var nv = document.querySelector('#anRoot .an-nav'); if (nv && nv.scrollIntoView) nv.scrollIntoView({ block: 'start' });
  }

  /* ---------- drawing ---------- */
  function drawCharts() {
    var d = S.data; if (!d || S.status !== 'ready') return;
    var days = d.daily || [], r = rank(), cmp = S.compare && r >= 2 && hasPrev(d), pd = d.prev_daily || [];
    var main = $('anMain');
    if (main) {
      if (days.length < 2) {
        var by = [], h; for (h = 0; h < 24; h++) by[h] = 0; (d.heat || []).forEach(function (x) { by[x.hour] += num(x.n); });
        var mx = Math.max.apply(null, [1].concat(by));
        main.innerHTML = '<p class="an-hint" style="margin:0 0 10px">Customer messages by hour</p>' + hbars(by.map(function (v, i) { return { n: hourLabel(i), v: v }; }).filter(function (x) { return x.v > 0; }), '#3D6BFF') || '';
        if (!by.some(function (v) { return v > 0; })) main.innerHTML = '<p class="an-hint">No customer messages today yet.</p>';
        animateBars(main);
      } else {
        var series = [];
        if (S.showConv) series.push({ key: 'conv', label: 'Conversations', color: '#3D6BFF', values: days.map(function (x) { return num(x.conversations); }), prev: cmp ? days.map(function (x, i) { return pd[i] ? num(pd[i].conversations) : null; }) : null, axis: 'l' });
        if (S.showMsg) series.push({ key: 'msg', label: 'Messages', color: '#22C493', values: days.map(function (x) { return num(x.messages); }), prev: cmp ? days.map(function (x, i) { return pd[i] ? num(pd[i].messages) : null; }) : null, axis: (S.showConv ? 'r' : 'l') });
        if (!series.length) main.innerHTML = '<p class="an-hint">Turn on Conversations or Messages to see the chart.</p>';
        else lineChart(main, { x: days.map(function (x) { return x.d; }), series: series, dual: series.length > 1, compare: cmp, label: 'Conversations and messages over time', xlabel: shortDate, tipTitle: longDate, onPick: r >= 2 ? function (i) { var day = days[i].d; drillTo({ type: 'day', day: day, label: longDate(day) + ' - conversations' }); } : null });
      }
    }
    var heat = $('anHeat'); if (heat) heatmap(heat, d.heat || []);
    var rt = $('anRate');
    if (rt) { var pts = days.filter(function (x) { return num(x.answered) + num(x.unanswered) > 0; }); lineChart(rt, { x: pts.map(function (x) { return x.d; }), series: [{ key: 'r', label: 'Answer rate %', color: '#8FAEFF', values: pts.map(function (x) { return Math.round(rate(x.answered, x.unanswered) * 10) / 10; }), axis: 'l' }], dual: false, compare: false, label: 'Answer rate over time', xlabel: shortDate, tipTitle: longDate }); }
    var pt = $('anProdTrend');
    if (pt && (d.products || []).length) {
      var cols = ['#FF6B45', '#3D6BFF', '#22C493'], top = d.products.slice(0, 3), idx = {}; days.forEach(function (x, i) { idx[x.d] = i; });
      var ser = top.map(function (p, k) { var vals = days.map(function () { return 0; }); (d.product_daily || []).forEach(function (z) { if (z.product_id === p.product_id && idx[z.d] != null) vals[idx[z.d]] = num(z.clicks); }); return { label: p.name, color: cols[k], values: vals }; });
      multiLine(pt, days.map(function (x) { return x.d; }), ser);
    }
  }

  function wire() {
    var root = $('anRoot'); if (!root) return;
    root.querySelectorAll('[data-range]').forEach(function (b) { b.addEventListener('click', function () { if (b.disabled) return; S.range = b.dataset.range; if (S.range === 'custom') { if (!S.custom.from) { var t = startOfDay(new Date()), f = new Date(t); f.setDate(f.getDate() - 29); S.custom = { from: f.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) }; } } S.drill = null; load(false); }); });
    var ap = $('anApply'); if (ap) ap.addEventListener('click', function () { S.custom = { from: $('anFrom').value, to: $('anTo').value }; if (S.custom.from && S.custom.to && S.custom.from <= S.custom.to) { S.drill = null; load(false); } });
    root.querySelectorAll('[data-tog]').forEach(function (b) { b.addEventListener('click', function () { var k = b.dataset.tog; if (k === 'conv') S.showConv = !S.showConv; else if (k === 'msg') S.showMsg = !S.showMsg; else S.compare = !S.compare; renderAll(false); }); });
    root.querySelectorAll('button.an-bar').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = S.data, i = +b.dataset.i, isProd = b.dataset.kind === 'product';
        if (isProd) { var p = (d.products || [])[i]; if (p) drillTo({ type: 'product', product: p.product_id, label: p.name + ' - conversations where it was clicked' }); }
        else { var q = (d.questions || [])[i]; if (q) drillTo({ type: 'question', question: q.question, label: 'Unanswered: "' + q.question + '"' }); }
      });
    });
    root.querySelectorAll('[data-tab]').forEach(function (a) {
      function go() { if (S.tab === a.dataset.tab) return; S.tab = a.dataset.tab; renderAll(false); var n = root.querySelector('.an-nav'); if (n && n.scrollIntoView) n.scrollIntoView({ block: 'start' }); }
      a.addEventListener('click', go);
      a.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    var act = root.querySelector('.an-nav a.on'); if (act && act.scrollIntoView) { try { act.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) {} }
    var rb = $('anRetry'); if (rb) rb.addEventListener('click', function () { load(false); });
    var s = $('anSearch'), tm; if (s) s.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(function () { S.search = s.value.trim(); loadList(true); }, 350); });
    var f = $('anFilter'); if (f) f.addEventListener('change', function () { S.filter = f.value; loadList(true); });
    var so = $('anSort'); if (so) so.addEventListener('change', function () { S.sort = so.value; loadList(true); });
    var cd = $('anClearDrill'); if (cd) cd.addEventListener('click', function () { S.drill = null; renderAll(true); });
    animateBars(root);
  }

  function renderAll(reloadList) {
    var root = $('anRoot'); if (!root) return;
    var r = rank(), html = '<div class="an">';
    if (r === 0) {
      html += '<div class="an-head"><div><h1>Analytics</h1><p>Track your AI\'s performance, customer activity, conversations, and product engagement.</p></div></div>' + lock('Your free trial has ended', 'Basic', 'Choose a plan to see your analytics and conversations again.') ;
      root.innerHTML = html + '</div>'; return;
    }
    html += controls();
    if (!agentId()) { html += '<div class="an-card an-empty"><h3>No assistant yet</h3><p>Create your AI assistant first. Analytics appear once customers start chatting.</p><div class="acts"><button type="button" class="btn btn-primary btn-sm" onclick="showView(\'training\')">Set up your AI</button></div></div></div>'; root.innerHTML = html; wire(); return; }
    if (S.status === 'loading' || S.status === 'idle') html += skeleton() + '</div>';
    else if (S.status === 'error') html += '<div class="an-card an-err"><h3>Analytics could not load</h3><p class="sub" style="color:#FFB19A">' + esc(S.err) + '</p><p class="an-hint">If this is the first time, run auvii-analytics.sql in Supabase, then try again.</p><button type="button" class="btn btn-primary btn-sm" id="anRetry" style="margin-top:8px">Try again</button></div>' + listShell() + '</div>';
    else {
      var d = S.data, empty = num(d.cur.conversations) + num(d.cur.messages) + num(d.cur.clicks) === 0;
      html += kpiHtml(d);
      if (!empty) html += navHtml();
      if (empty) html += '<section class="an-sec"><div class="an-card an-empty"><h3>No analytics yet</h3><p>Your analytics will appear here once customers start interacting with your Auvii assistant in this period.</p><div class="acts"><button type="button" class="btn btn-primary btn-sm" onclick="showView(\'training\')">Test your AI</button><button type="button" class="btn btn-ghost btn-sm" onclick="showView(\'connect\')">Connect your website</button></div></div></section>';
      else {
        var t = S.tab;
        html += t === 'overview' ? mainHtml(d) : t === 'activity' ? activityHtml(d) : t === 'ai' ? aiHtml(d) : t === 'products' ? productsHtml(d) : t === 'insights' ? insightsHtml(d) : t === 'conv' ? listShell() : advancedHtml(d);
      }
      html += '</div>';
    }
    root.innerHTML = html; wire();
    if (S.status === 'ready') {
      drawCharts();
      if (S.tab === 'conv') { paintList(); if (reloadList || (!S.list.rows.length && !S.list.loading && !S.list.err)) loadList(true); }
    } else if (S.status === 'error') paintList();
  }

  function load(silent) {
    var id = agentId(); if (!id) { renderAll(false); return Promise.resolve(); }
    if (!silent) { S.status = 'loading'; renderAll(false); }
    var r = rangeDates();
    return rpc('auvii_an_summary', { p_agent: id, p_from: r.from.toISOString(), p_to: r.to.toISOString(), p_tz: TZ })
      .then(function (d) { S.data = d; S.status = 'ready'; S.err = ''; })
      .catch(function (e) { S.status = 'error'; S.err = e.message || 'Unknown error'; })
      .then(function () { renderAll(true); });
  }

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if ($('anRoot') && S.status === 'ready' && $('view-analytics') && $('view-analytics').classList.contains('active')) drawCharts(); }, 150); });

  window.AuviiAnalytics = {
    open: function () { injectCss(); if (!S.opened || S.status === 'error') { S.opened = true; load(false); } else { renderAll(false); load(true); } },
    refresh: function () { return load(true); },
    _state: S
  };
})();
