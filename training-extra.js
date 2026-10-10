/* Training Center extras (loaded after training-app.js; nothing in training-app.js is replaced).
   1) Product photos from the gallery or a link   2) Survey and ratings builder + results
   3) Makes tabs and option pills respond even if the main script missed them
   4) A self-check that names any button whose code is missing */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function warn(msg) { try { (window.__auviiShowErr || console.warn)(msg); } catch (e) {} }

  /* ---------- which agent is this? ---------- */
  var agentPromise = null;
  function getAgentId() {
    if (agentPromise) return agentPromise;
    agentPromise = (async function () {
      var q = new URLSearchParams(location.search).get('agent');
      var u = await sb.auth.getUser();
      var user = u && u.data && u.data.user;
      if (!user) throw new Error('Please log in again.');
      var r = await sb.from('ai_agents').select('id').eq('user_id', user.id).order('created_at', { ascending: true });
      var rows = (r && r.data) || [];
      if (q && rows.some(function (a) { return a.id === q; })) return q;
      if (!rows.length) throw new Error('Create your AI agent first.');
      return rows[0].id;
    })();
    agentPromise.catch(function () { agentPromise = null; });
    return agentPromise;
  }

  /* ---------- 1) tabs + pills work no matter what ---------- */
  function showPanel(name) {
    var p = $(name); if (!p || !p.classList.contains('panel')) return;
    document.querySelectorAll('.panel').forEach(function (x) { x.classList.toggle('active', x === p); });
    document.querySelectorAll('.nav button').forEach(function (b) { b.classList.toggle('active', b.dataset.panel === name); });
  }
  document.querySelectorAll('.nav button[data-panel]').forEach(function (b) {
    b.addEventListener('click', function () {
      showPanel(b.dataset.panel);
      window.scrollTo({ top: 0 });
      if (b.dataset.panel === 'survey') loadSurvey(false);
    });
  });

  /* one choice per row; safe even if training-app.js also handles these */
  document.querySelectorAll('#toneRow,#lengthRow,#saToneRow,#saStyleRow').forEach(function (row) {
    row.addEventListener('click', function (e) {
      var pill = e.target.closest ? e.target.closest('.pill') : null;
      if (!pill || !row.contains(pill)) return;
      row.querySelectorAll('.pill').forEach(function (p) { p.classList.toggle('selected', p === pill); });
    });
  });

  /* ---------- 2) product photo: gallery or link ---------- */
  var imgInput = $('pImageUrl'), prev = $('pPreview'), stat = $('pUploadStatus'), file = $('pFile'), pick = $('pPickBtn');

  function setPreview(url) {
    if (!prev) return;
    if (url && /^https?:\/\//i.test(url)) { prev.src = url; prev.classList.add('show'); }
    else { prev.removeAttribute('src'); prev.classList.remove('show'); }
  }

  function shrink(f) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(f), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { URL.revokeObjectURL(url); reject(new Error('empty')); return; }
        var k = Math.min(1, 1000 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not prepare the photo.')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That file is not a photo.')); };
      img.src = url;
    });
  }

  if (pick && file) {
    pick.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', async function () {
      var f = file.files && file.files[0]; file.value = '';
      if (!f) return;
      if (!/^image\//i.test(f.type)) { stat.textContent = 'Please choose a photo (JPG, PNG or WEBP).'; return; }
      pick.disabled = true; stat.textContent = 'Uploading photo...';
      try {
        var id = await getAgentId();
        var blob = await shrink(f);
        var path = id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        var up = await sb.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
        var pub = sb.storage.from('product-images').getPublicUrl(path);
        var url = pub && pub.data && pub.data.publicUrl;
        if (!url) throw new Error('No link was returned.');
        imgInput.value = url; setPreview(url);
        stat.textContent = 'Photo added. Tap "Save Product" to keep it.';
      } catch (e) {
        var m = String((e && e.message) || e);
        stat.textContent = /bucket|not found|policy|row-level/i.test(m)
          ? 'Gallery upload is not set up yet. Run auvii-survey.sql in Supabase, or paste an image link instead.'
          : 'Could not upload: ' + m;
      } finally { pick.disabled = false; }
    });
  }
  if (imgInput) imgInput.addEventListener('input', function () { setPreview(imgInput.value.trim()); });

  /* ---------- 3) survey + ratings ---------- */
  var SV = { questions: [], loaded: false };
  var TYPES = [['stars', 'Star rating (1 to 5)'], ['yesno', 'Yes or No'], ['text', 'Short answer']];

  function drawQuestions() {
    var box = $('svQuestions'); if (!box) return;
    if (!SV.questions.length) { box.innerHTML = '<div class="empty" style="margin-bottom:10px">No questions yet. Add the first question you want to ask.</div>'; $('svAdd').disabled = false; return; }
    box.innerHTML = SV.questions.map(function (q, i) {
      return '<div class="qcard" data-i="' + i + '"><div class="qtop"><b>QUESTION ' + (i + 1) + '</b><button type="button" class="delete" data-del="' + i + '">Remove</button></div>' +
        '<div class="field" style="margin-bottom:8px"><input data-text="' + i + '" maxlength="140" placeholder="For example: How would you rate our service?" value="' + esc(q.text) + '"></div>' +
        '<select data-type="' + i + '">' + TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (q.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
        '<label class="req"><input type="checkbox" data-req="' + i + '"' + (q.required ? ' checked' : '') + '> Customer must answer this</label></div>';
    }).join('');
    $('svAdd').disabled = SV.questions.length >= 6;
  }

  var qbox = $('svQuestions');
  if (qbox) {
    qbox.addEventListener('input', function (e) { var i = e.target.dataset.text; if (i != null) SV.questions[+i].text = e.target.value; });
    qbox.addEventListener('change', function (e) {
      var t = e.target.dataset;
      if (t.type != null) SV.questions[+t.type].type = e.target.value;
      if (t.req != null) SV.questions[+t.req].required = e.target.checked;
    });
    qbox.addEventListener('click', function (e) {
      var d = e.target.dataset && e.target.dataset.del;
      if (d != null) { SV.questions.splice(+d, 1); drawQuestions(); }
    });
  }
  if ($('svAdd')) $('svAdd').addEventListener('click', function () {
    if (SV.questions.length >= 6) return;
    SV.questions.push({ type: SV.questions.length ? 'text' : 'stars', text: '', required: false });
    drawQuestions();
    var last = qbox.querySelector('.qcard:last-child input[data-text]'); if (last) last.focus();
  });

  function toast(msg, ok) {
    var t = $('svToast'); if (!t) return;
    t.textContent = msg; t.style.color = ok ? 'var(--green)' : '#FFB19A'; t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 3500);
  }

  async function loadSurvey(force) {
    if (SV.loaded && !force) return;
    try {
      var id = await getAgentId();
      var r = await sb.from('agent_surveys').select('*').eq('agent_id', id).maybeSingle();
      if (r.error) throw r.error;
      var row = r.data || {};
      $('svRating').checked = !!row.rating_enabled;
      $('svEnabled').checked = !!row.survey_enabled;
      $('svTitle').value = row.title || '';
      $('svAfter').value = String(row.trigger_after || 4);
      SV.questions = Array.isArray(row.questions) ? row.questions.map(function (q) { return { type: q.type || 'text', text: q.text || '', required: !!q.required }; }) : [];
      SV.loaded = true; drawQuestions();
    } catch (e) {
      var m = String((e && e.message) || e);
      toast(/relation|does not exist|schema cache/i.test(m) ? 'Run auvii-survey.sql in Supabase first.' : 'Could not load: ' + m, false);
      drawQuestions();
    }
    loadResults();
  }

  async function saveSurvey() {
    var btn = $('svSave'); btn.disabled = true;
    try {
      var id = await getAgentId();
      var qs = SV.questions.map(function (q) { return { type: q.type, text: String(q.text || '').trim().slice(0, 140), required: !!q.required }; }).filter(function (q) { return q.text; }).slice(0, 6);
      if ($('svEnabled').checked && !qs.length) { toast('Add at least one question, or turn the survey off.', false); btn.disabled = false; return; }
      var row = { agent_id: id, rating_enabled: $('svRating').checked, survey_enabled: $('svEnabled').checked, title: ($('svTitle').value.trim() || 'How did we do?').slice(0, 80), questions: qs, trigger_after: parseInt($('svAfter').value, 10) || 4, updated_at: new Date().toISOString() };
      var r = await sb.from('agent_surveys').upsert(row, { onConflict: 'agent_id' });
      if (r.error) throw r.error;
      SV.questions = qs; drawQuestions(); toast('\u2713 Saved', true);
    } catch (e) {
      var m = String((e && e.message) || e);
      toast(/relation|does not exist|schema cache/i.test(m) ? 'Run auvii-survey.sql in Supabase first.' : 'Could not save: ' + m, false);
    }
    btn.disabled = false;
  }
  if ($('svSave')) $('svSave').addEventListener('click', saveSurvey);
  if ($('svRefresh')) $('svRefresh').addEventListener('click', function () { loadResults(); });

  function timeAgo(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    var d = new Date(iso); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }

  async function loadResults() {
    var box = $('svResults'); if (!box) return;
    box.innerHTML = '<div class="empty">Loading…</div>';
    try {
      var id = await getAgentId();
      var rs = await sb.from('survey_responses').select('*').eq('agent_id', id).order('created_at', { ascending: false }).limit(20);
      var rt = await sb.from('message_ratings').select('rating').eq('agent_id', id).order('created_at', { ascending: false }).limit(2000);
      if (rs.error) throw rs.error;
      var rows = rs.data || [], ratings = (rt && rt.data) || [];
      var up = ratings.filter(function (x) { return x.rating === 1; }).length, down = ratings.filter(function (x) { return x.rating === -1; }).length;
      var stars = []; rows.forEach(function (r) { (r.answers || []).forEach(function (a) { if (a.type === 'stars' && Number(a.a) >= 1) stars.push(Number(a.a)); }); });
      var avg = stars.length ? (stars.reduce(function (a, b) { return a + b; }, 0) / stars.length).toFixed(1) : '-';
      var pct = (up + down) ? Math.round(up / (up + down) * 100) + '%' : '-';
      var head = '<div class="stat3"><div><b>' + rows.length + '</b><span>Survey answers</span></div><div><b>' + avg + (avg !== '-' ? ' &#9733;' : '') + '</b><span>Average stars</span></div><div><b>' + pct + '</b><span>&#128077; of ' + (up + down) + ' ratings</span></div></div>';
      if (!rows.length) { box.innerHTML = head + '<div class="empty">No survey answers yet. They appear here once customers complete your survey.</div>'; return; }
      box.innerHTML = head + rows.map(function (r) {
        var who = r.customer_name || r.customer_email || 'Customer';
        return '<div class="resp"><div class="who"><b>' + esc(who) + '</b><span>' + esc(timeAgo(r.created_at)) + '</span></div>' +
          (r.answers || []).map(function (a) { return '<div class="qa"><span>' + esc(a.q) + '</span><br>' + (a.type === 'stars' ? '&#9733; ' + esc(a.a) + ' / 5' : esc(a.a)) + '</div>'; }).join('') + '</div>';
      }).join('');
    } catch (e) {
      var m = String((e && e.message) || e);
      box.innerHTML = '<div class="empty">' + (/relation|does not exist|schema cache/i.test(m) ? 'Run auvii-survey.sql in Supabase to turn this on.' : 'Could not load results: ' + esc(m)) + '</div>';
    }
  }

  /* ---------- 4) self-check: name any button with no code behind it ---------- */
  function selfCheck() {
    var missing = {};
    document.querySelectorAll('[onclick]').forEach(function (el) {
      var m = /^\s*([A-Za-z_$][\w$]*)\s*\(/.exec(el.getAttribute('onclick') || '');
      if (m && typeof window[m[1]] !== 'function') missing[m[1]] = true;
    });
    var names = Object.keys(missing);
    if (names.length) warn('These buttons have no code behind them in training-app.js: ' + names.join(', ') + '. Send training-app.js to your developer to fix them.');
  }
  setTimeout(selfCheck, 2500);

  /* ---------- 5) each plan sees only its own tools: Basic has no Sales Assistant ---------- */
  (async function planTools() {
    try {
      if (typeof AUVII_PAGE_FOR === 'undefined') return;
      var s = await sb.auth.getSession(), session = s && s.data && s.data.session;
      if (!session) return;
      var key;
      if (!AUVII_BILLING_LIVE) key = auviiPreviewPlan();
      else {
        var r = await sb.from('subscriptions').select('*').eq('user_id', session.user.id).maybeSingle();
        key = auviiPlanKeyFromRow(r && r.data, session.user.created_at);
      }
      if (AUVII_PAGE_FOR[key] === 'basic') {
        var tab = document.querySelector('.nav button[data-panel="sales"]'), panel = $('sales');
        if (tab) tab.remove();
        if (panel) panel.remove();
      }
    } catch (e) { /* if the plan cannot be read, leave the page as it is */ }
  })();

  if (location.hash === '#survey') { showPanel('survey'); loadSurvey(false); }
})();
