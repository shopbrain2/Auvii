/* Auvii Home - the product home and guide.
   Loaded by basic.html, standard.html and premium.html. It only READS data (your agent, saved widget
   settings, counts and recent conversations) and links to the existing pages. Nothing here changes
   training, crawling, billing or any other feature. */
(function () {
  'use strict';

  var H = { painted: false, stats: null, widget: null, recent: null, recentErr: false, token: 0, agentId: null };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { var v = Number(n); return isFinite(v) ? v.toLocaleString() : '0'; }
  function agent() { try { return (typeof currentAgent !== 'undefined' && currentAgent) || null; } catch (e) { return null; } }
  function user() { try { return (typeof currentUser !== 'undefined' && currentUser) || null; } catch (e) { return null; } }
  function ent() { try { return auviiEnt(); } catch (e) { return { name: '', widget: { size: true, custom: true, effects: true }, sales: true }; } }
  function planKey() { try { return getAuviiPlanKey(); } catch (e) { return 'free'; } }
  function ago(iso) {
    var t = new Date(iso).getTime(); if (!t) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' d ago';
    var d = new Date(iso); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }

  /* ---------- styles ---------- */
  function css() {
    if ($('hmStyles')) return;
    var st = document.createElement('style'); st.id = 'hmStyles';
    st.textContent =
'.hm{max-width:1080px;margin:0 auto;padding-bottom:36px}.hm *{box-sizing:border-box}' +
'@keyframes hmUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
'.hm .rv{opacity:0;animation:hmUp .6s cubic-bezier(.2,.8,.2,1) forwards}.hm .d1{animation-delay:.05s}.hm .d2{animation-delay:.12s}.hm .d3{animation-delay:.19s}.hm .d4{animation-delay:.26s}.hm .d5{animation-delay:.33s}' +
'.hm-hero{position:relative;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:22px;align-items:center;padding:26px;border-radius:24px;border:1px solid var(--line);overflow:hidden;background:radial-gradient(700px 320px at 100% 0%,rgba(61,107,255,.22),transparent 60%),radial-gradient(520px 280px at 0% 100%,rgba(138,92,246,.14),transparent 60%),var(--white,#0F1527)}' +
'.hm-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:#8FAEFF;letter-spacing:.04em;text-transform:uppercase}' +
'.hm-hero h1{margin:8px 0 8px;font-size:clamp(26px,5.4vw,40px);line-height:1.08;letter-spacing:-.02em}' +
'.hm-hero p.lead{margin:0 0 16px;color:var(--ink-soft);font-size:15px;line-height:1.55;max-width:460px}' +
'.hm-agent{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.04);max-width:420px}' +
'.hm-agent .nm{font-weight:700;font-size:15px;overflow-wrap:anywhere}.hm-agent .sub{font-size:12.5px;color:var(--ink-soft);overflow-wrap:anywhere}' +
'.hm-av{width:44px;height:44px;border-radius:50%;overflow:hidden;flex:none;background:var(--c,#3D6BFF);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700}.hm-av img{width:100%;height:100%;object-fit:cover}' +
'.hm-pill{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#6FE3BE;background:rgba(34,196,147,.14);border-radius:99px;padding:4px 10px;flex:none}.hm-pill i{width:7px;height:7px;border-radius:50%;background:#22C493;display:inline-block;box-shadow:0 0 0 0 rgba(34,196,147,.6);animation:hmPulse 2s infinite}' +
'@keyframes hmPulse{70%{box-shadow:0 0 0 7px rgba(34,196,147,0)}100%{box-shadow:0 0 0 0 rgba(34,196,147,0)}}' +
'.hm-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}' +
'.hm-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:11px 18px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--ink);font:600 14px inherit;font-family:inherit;cursor:pointer;text-decoration:none;transition:transform .15s,background .15s,border-color .15s}' +
'.hm-btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.09)}.hm-btn:active{transform:translateY(0)}' +
'.hm-btn.pri{background:linear-gradient(135deg,#4B78FF,#2F5FFF);border-color:transparent;color:#fff;box-shadow:0 8px 22px rgba(47,95,255,.35)}.hm-btn.pri:hover{background:linear-gradient(135deg,#5A84FF,#3D6BFF)}' +
'.hm-btn.sm{min-height:38px;padding:8px 13px;font-size:13px;border-radius:10px}' +
/* live widget preview */
'.hm-stage{position:relative;min-height:330px;display:flex;align-items:center;justify-content:center}' +
'.hm-chat{width:min(300px,100%);border-radius:20px;overflow:hidden;background:#fff;color:#1C1C1E;box-shadow:0 24px 60px rgba(0,0,0,.5);transform:rotate(-1.2deg);animation:hmFloat 6s ease-in-out infinite}' +
'@keyframes hmFloat{0%,100%{transform:translateY(0) rotate(-1.2deg)}50%{transform:translateY(-6px) rotate(-1.2deg)}}' +
'.hm-chat .hd{background:var(--c,#3D6BFF);color:#fff;padding:11px 13px;display:flex;align-items:center;gap:10px}.hm-chat .hd .hm-av{width:34px;height:34px;background:rgba(255,255,255,.22);font-size:14px}' +
'.hm-chat .hd b{display:block;font-size:14px}.hm-chat .hd span{font-size:11px;opacity:.9}' +
'.hm-chat .bd{background:#F1F3F7;padding:12px 11px;display:flex;flex-direction:column;gap:8px;min-height:176px}' +
'.hm-m{max-width:84%;padding:8px 11px;border-radius:15px;font-size:13px;line-height:1.4;overflow-wrap:anywhere}.hm-m.a{background:#fff;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.06);align-self:flex-start}.hm-m.c{background:var(--c,#3D6BFF);color:#fff;border-bottom-right-radius:4px;align-self:flex-end}' +
'.hm-m.t{opacity:0;animation:hmUp .5s .9s forwards}.hm-m.t2{opacity:0;animation:hmUp .5s 1.5s forwards}' +
'.hm-chat .ft{background:#fff;padding:8px 10px;border-top:1px solid #E8EAEE;display:flex;gap:8px;align-items:center}.hm-chat .ft i{flex:1;height:30px;border-radius:15px;background:#F1F3F7}.hm-chat .ft u{width:30px;height:30px;border-radius:50%;background:var(--c,#3D6BFF);display:block}' +
'.hm-ex{position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);font-size:11px;color:var(--ink-soft);white-space:nowrap}' +
/* bubble (same look and effects as the real widget) */
'.hm-dock{position:absolute;right:6px;bottom:16px;width:var(--s,58px);height:var(--s,58px);perspective:700px}' +
'.hm-dock.sm{position:relative;right:auto;bottom:auto;flex:none}' +
'.hm-bub{position:relative;z-index:2;width:100%;height:100%;border-radius:50%;background:var(--c,#3D6BFF);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.35);transform-style:preserve-3d;color:#fff;font-weight:700}.hm-bub img{width:100%;height:100%;object-fit:cover}' +
'.hm-fx{position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:1;display:none}' +
'.hm-e-glow .hm-bub{animation:hmGlow 2.2s ease-in-out infinite}' +
'@keyframes hmGlow{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--c) 55%,transparent),0 6px 20px rgba(0,0,0,.3)}50%{box-shadow:0 0 0 16px color-mix(in srgb,var(--c) 0%,transparent),0 0 28px 6px color-mix(in srgb,var(--c) 60%,transparent)}}' +
'.hm-e-ripple .hm-fx1,.hm-e-ripple .hm-fx2{display:block;border:2px solid var(--c);animation:hmRip 2.4s ease-out infinite}.hm-e-ripple .hm-fx2{animation-delay:1.2s}@keyframes hmRip{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.9);opacity:0}}' +
'.hm-e-ring .hm-fx1{display:block;inset:-6px;animation:hmSpin 2.8s linear infinite;background:conic-gradient(from 0deg,var(--c),transparent 35%,var(--c) 65%,transparent 90%,var(--c));-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px))}@keyframes hmSpin{to{transform:rotate(360deg)}}' +
'.hm-e-float3d .hm-bub{animation:hmF3 4.2s ease-in-out infinite;box-shadow:0 14px 26px rgba(0,0,0,.4),inset 0 -7px 12px rgba(0,0,0,.28),inset 0 7px 12px rgba(255,255,255,.3)}' +
'.hm-e-float3d .hm-fx1{display:block;inset:auto;left:16%;right:16%;bottom:-12px;height:9px;border-radius:50%;background:rgba(0,0,0,.3);filter:blur(4px)}' +
'@keyframes hmF3{0%,100%{transform:translateY(0) rotateX(0) rotateY(0)}25%{transform:translateY(-6px) rotateX(12deg) rotateY(-16deg)}50%{transform:translateY(-2px) rotateX(-8deg) rotateY(0)}75%{transform:translateY(-7px) rotateX(10deg) rotateY(16deg)}}' +
'.hm-e-tilt3d .hm-bub{animation:hmSway 5s ease-in-out infinite;box-shadow:0 12px 24px rgba(0,0,0,.4),inset 0 -6px 12px rgba(0,0,0,.25),inset 0 6px 12px rgba(255,255,255,.28)}@keyframes hmSway{0%,100%{transform:rotateY(-16deg) rotateX(6deg)}50%{transform:rotateY(16deg) rotateX(-6deg)}}' +
'.hm-e-float3d .hm-bub::after,.hm-e-tilt3d .hm-bub::after{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 24%,rgba(255,255,255,.55),rgba(255,255,255,0) 46%)}' +
/* sections */
'.hm-sec{margin-top:34px}.hm-sec>h2{margin:0;font-size:22px;letter-spacing:-.01em}.hm-sec>.sub{margin:5px 0 16px;color:var(--ink-soft);font-size:14px;max-width:620px}' +
'.hm-steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}' +
'.hm-step{position:relative;display:flex;flex-direction:column;gap:8px;padding:16px;border:1px solid var(--line);border-radius:18px;background:var(--white,#0F1527);transition:transform .2s,border-color .2s}' +
'.hm-step:hover{transform:translateY(-2px);border-color:rgba(61,107,255,.5)}' +
'.hm-step .no{font-size:11.5px;font-weight:800;letter-spacing:.08em;color:#8FAEFF}' +
'.hm-step h3{margin:0;font-size:16.5px}.hm-step p{margin:0;font-size:13.5px;line-height:1.5;color:var(--ink-soft)}' +
'.hm-step .go{margin-top:auto;padding-top:6px}' +
'.hm-step.wide{grid-column:1/-1}.hm-step.wide .row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center}' +
'.hm-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}.hm-chip{font-size:12px;font-weight:600;padding:5px 10px;border-radius:99px;border:1px solid var(--line);background:rgba(255,255,255,.04)}.hm-chip.lock{color:var(--ink-soft);border-style:dashed}' +
'.hm-minip{display:flex;align-items:center;justify-content:center;padding:10px 18px}' +
'.hm-caps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}' +
'.hm-cap{padding:15px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025);transition:transform .2s,background .2s}.hm-cap:hover{transform:translateY(-2px);background:rgba(255,255,255,.05)}' +
'.hm-cap .ic{font-size:22px;display:block;margin-bottom:8px}.hm-cap b{display:block;font-size:14.5px;margin-bottom:3px}.hm-cap span{display:block;font-size:12.8px;color:var(--ink-soft);line-height:1.45}.hm-cap em{display:inline-block;margin-top:6px;font-style:normal;font-size:11px;font-weight:700;color:#8FAEFF}' +
'.hm-quick{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}' +
'.hm-q{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.03);color:var(--ink);font:600 13px inherit;font-family:inherit;cursor:pointer;text-align:center;transition:transform .15s,border-color .15s}.hm-q:hover{transform:translateY(-2px);border-color:rgba(61,107,255,.5)}.hm-q .ic{font-size:20px}' +
'.hm-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:14px;margin-top:34px}' +
'.hm-card{padding:18px;border:1px solid var(--line);border-radius:18px;background:var(--white,#0F1527);min-width:0}.hm-card h3{margin:0 0 12px;font-size:16px;display:flex;align-items:center;justify-content:space-between;gap:8px}' +
'.hm-nums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.hm-num{padding:10px 6px;border-radius:14px;background:rgba(255,255,255,.04);text-align:center}.hm-num b{display:block;font-size:22px;letter-spacing:-.01em}.hm-num span{font-size:11.5px;color:var(--ink-soft)}' +
'.hm-plan{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:11px 13px;border-radius:14px;border:1px solid var(--line);font-size:13.5px}.hm-plan b{display:block;font-size:15px}.hm-plan span{color:var(--ink-soft);font-size:12px}' +
'.hm-rc{display:grid;gap:8px}.hm-r{display:block;width:100%;text-align:left;padding:11px 13px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025);color:inherit;font:inherit;cursor:pointer;transition:border-color .15s}.hm-r:hover{border-color:rgba(61,107,255,.55)}' +
'.hm-r .t{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:var(--ink-soft)}.hm-r .t b{color:var(--ink);font-size:13.5px}.hm-r .q{margin-top:4px;font-size:13.5px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
'.hm-empty{text-align:center;padding:22px 12px}.hm-empty .big{font-size:30px;margin-bottom:6px}.hm-empty h4{margin:0 0 4px;font-size:15.5px}.hm-empty p{margin:0 auto 12px;color:var(--ink-soft);font-size:13.5px;max-width:330px;line-height:1.5}' +
'.hm-sk{background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.1),rgba(255,255,255,.04));background-size:200% 100%;animation:hmSk 1.3s infinite;border-radius:12px}@keyframes hmSk{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
'@media(max-width:860px){.hm-hero{grid-template-columns:minmax(0,1fr);padding:20px;gap:10px}.hm-stage{min-height:300px}.hm-caps{grid-template-columns:repeat(2,minmax(0,1fr))}.hm-quick{grid-template-columns:repeat(3,minmax(0,1fr))}.hm-two{grid-template-columns:minmax(0,1fr)}}' +
'@media(max-width:560px){.hm-steps{grid-template-columns:minmax(0,1fr)}.hm-step{padding:14px}.hm-step.wide .row{grid-template-columns:minmax(0,1fr)}.hm-hero{border-radius:20px}.hm-sec{margin-top:28px}.hm-sec>h2{font-size:20px}.hm-btn{flex:1 1 auto}.hm-caps{gap:9px}.hm-cap{padding:12px}}' +
'.hm-still .rv,.hm-still .hm-m.t,.hm-still .hm-m.t2{animation:none;opacity:1}' +
'@media(prefers-reduced-motion:reduce){.hm .rv{animation:none;opacity:1}.hm-chat,.hm-bub,.hm-fx,.hm-pill i,.hm-m.t,.hm-m.t2{animation:none!important;opacity:1}}';
    document.head.appendChild(st);
  }

  /* ---------- the user's saved widget look ---------- */
  function look() {
    var w = H.widget || {}, e = ent().widget || {};
    var effect = ['glow', 'ripple', 'float3d', 'ring', 'tilt3d'].indexOf(w.widget_effect) !== -1 && e.effects ? w.widget_effect : 'none';
    var size = ({ small: 48, medium: 58, large: 72 })[w.widget_size] || 58;
    var a = agent() || {};
    return { color: w.theme_color || '#3D6BFF', avatar: w.avatar_url || '', effect: effect, size: e.size ? size : 58, welcome: w.welcome_message || 'Hi! How can I help you today?', name: a.agent_name || 'Auvii Assistant' };
  }
  function avatarHtml(L) { return L.avatar ? '<img src="' + esc(L.avatar) + '" alt="">' : esc((L.name || 'A').trim().charAt(0).toUpperCase()); }
  function bubble(L, small) {
    return '<div class="hm-dock ' + (small ? 'sm ' : '') + 'hm-e-' + L.effect + '" style="--c:' + esc(L.color) + ';--s:' + (small ? 56 : L.size) + 'px"><span class="hm-fx hm-fx1"></span><span class="hm-fx hm-fx2"></span><div class="hm-bub">' + avatarHtml(L) + '</div></div>';
  }

  /* ---------- sections ---------- */
  function hero(L) {
    var u = user() || {};
    return '<section class="hm-hero rv">' +
      '<div><span class="hm-eyebrow">Welcome to Auvii &#128075;</span><h1>Your AI customer-service assistant is ready</h1>' +
      '<p class="lead">Auvii answers your customers, recommends products and works around the clock for ' + esc(u.storeName || 'your business') + '.</p>' +
      '<div class="hm-agent" style="--c:' + esc(L.color) + '"><div class="hm-av">' + avatarHtml(L) + '</div><div style="min-width:0"><div class="nm">' + esc(L.name) + '</div><div class="sub">' + esc(u.storeName || '') + '</div></div><span class="hm-pill"><i></i>Active</span></div>' +
      '<div class="hm-cta"><a class="hm-btn pri" href="training-center.html">&#9654; Test AI</a><button type="button" class="hm-btn" data-go="connect">&#127912; Customize</button></div></div>' +
      '<div class="hm-stage" style="--c:' + esc(L.color) + '" aria-hidden="true"><div class="hm-chat"><div class="hd"><div class="hm-av">' + avatarHtml(L) + '</div><div><b>' + esc(L.name) + '</b><span>&#9679; Online</span></div></div>' +
      '<div class="bd"><div class="hm-m a">' + esc(L.welcome) + '</div><div class="hm-m c t">Do you deliver to my area?</div><div class="hm-m a t2">Happy to help! Tell me where you are and I will check.</div></div><div class="ft"><i></i><u></u></div></div>' +
      bubble(L, false) + '<span class="hm-ex">Preview with your saved look. Example chat.</span></div></section>';
  }

  function steps(L) {
    var e = ent(), w = e.widget || {};
    function chip(t, on) { return '<span class="hm-chip' + (on ? '' : ' lock') + '">' + (on ? '' : '&#128274; ') + t + '</span>'; }
    var cust = chip('Choose an avatar', true) + chip('Your own photo', !!w.custom) + chip('Widget colour and position', true) + chip('Widget size and distance', !!w.size) + chip('3D bubble effects', !!w.effects);
    return '<section class="hm-sec rv d2"><h2>How to use Auvii</h2><p class="sub">Everything you need to turn your AI assistant into part of your customer experience.</p><div class="hm-steps">' +
      '<div class="hm-step"><span class="no">STEP 01</span><h3>&#129504; Teach your AI</h3><p>Add your products, FAQs, business information and policies so your AI understands your business.</p><div class="go"><a class="hm-btn sm" href="training-center.html">Open Training Center</a></div></div>' +
      '<div class="hm-step wide"><div class="row"><div><span class="no">STEP 02</span><h3>&#127912; Customize your AI</h3><p>Make the assistant look and feel like your brand. This preview uses your saved settings.</p><div class="hm-chips">' + cust + '</div><div class="go"><button type="button" class="hm-btn sm pri" data-go="connect">Customize AI</button></div></div><div class="hm-minip" style="--c:' + esc(L.color) + '">' + bubble(L, true) + '</div></div></div>' +
      '<div class="hm-step"><span class="no">STEP 03</span><h3>&#128172; Test your AI</h3><p>Have a conversation with your AI before putting it in front of customers.</p><div class="go"><a class="hm-btn sm" href="training-center.html">Test AI</a></div></div>' +
      '<div class="hm-step"><span class="no">STEP 04</span><h3>&#127760; Connect your website</h3><p>Add Auvii to your website so customers can start chatting with your assistant.</p><div class="go"><button type="button" class="hm-btn sm" data-go="connect">Connect Website</button></div></div>' +
      '<div class="hm-step wide"><span class="no">STEP 05</span><h3>&#128202; Monitor your AI</h3><p>See customer conversations, messages, analytics and how well your AI is answering once it goes live.</p><div class="go" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="hm-btn sm" data-go="analytics">View Analytics</button><button type="button" class="hm-btn sm" data-go="conversations">View Conversations</button></div></div>' +
      '</div></section>';
  }

  function caps() {
    var e = ent(), key = planKey();
    var items = [
      ['&#128172;', 'Customer service', 'Answers questions about your business, products, policies, shipping and returns.', ''],
      ['&#128717;&#65039;', 'Sales Assistant', 'Helps customers find products, with recommendations, upselling and cross-selling.', e.sales ? '' : 'Standard and above'],
      ['&#129504;', 'Knowledge', 'Manage the products, FAQs and information your AI uses to answer.', ''],
      ['&#127912;', 'Customization', 'Avatar, your own photo, widget look, size and 3D bubble effects.', ''],
      ['&#127760;', 'Website widget', 'Put the chat on your website and let customers talk to your AI.', ''],
      ['&#128202;', 'Analytics', 'Charts of conversations, messages, product clicks and AI performance.', ''],
      ['&#128488;&#65039;', 'Conversations', 'Read every real customer chat and see how the AI replied.', '']
    ];
    return '<section class="hm-sec rv d3"><h2>What you can do with Auvii</h2><p class="sub">The main things your assistant can do for your business.</p><div class="hm-caps">' +
      items.map(function (i) { return '<div class="hm-cap"><span class="ic">' + i[0] + '</span><b>' + i[1] + '</b><span>' + i[2] + '</span>' + (i[3] ? '<em>&#128274; ' + i[3] + '</em>' : '') + '</div>'; }).join('') + '</div></section>';
  }

  function quick() {
    var q = [['&#129504;', 'Train AI', 'training-center.html'], ['&#127912;', 'Customize', 'connect'], ['&#9654;', 'Test AI', 'training-center.html'], ['&#127760;', 'Connect', 'connect'], ['&#128488;&#65039;', 'Conversations', 'conversations'], ['&#128202;', 'Analytics', 'analytics']];
    return '<section class="hm-sec rv d4"><h2>Quick actions</h2><div class="hm-quick" style="margin-top:12px">' +
      q.map(function (i) { return '<button type="button" class="hm-q" data-go="' + i[2] + '"><span class="ic">' + i[0] + '</span>' + i[1] + '</button>'; }).join('') + '</div></section>';
  }

  function planLine() {
    var e = ent(), key = planKey(), d = '';
    try { d = auviiTrialDaysLabel(); } catch (x) {}
    var name = key === 'expired' ? 'Plan ended' : e.name;
    return '<div class="hm-plan"><div><span>Current plan</span><b>' + esc(name) + (d ? ' &middot; ' + esc(d) : '') + '</b></div><button type="button" class="hm-btn sm" data-go="subscription">Manage plan</button></div>';
  }

  function activity() {
    var s = H.stats, body;
    if (!s) body = '<div class="hm-nums">' + [1, 2, 3].map(function () { return '<div class="hm-sk" style="height:62px"></div>'; }).join('') + '</div>';
    else body = '<div class="hm-nums"><div class="hm-num"><b>' + fmt(s.c) + '</b><span>Conversations</span></div><div class="hm-num"><b>' + fmt(s.m) + '</b><span>Messages</span></div><div class="hm-num"><b>' + fmt(s.k) + '</b><span>Knowledge items</span></div></div>' +
      (s.c === 0 ? '<div class="hm-empty" style="padding:16px 4px 4px"><h4>Your AI isn\'t live yet</h4><p>Connect Auvii to your website to start serving customers.</p><button type="button" class="hm-btn sm pri" data-go="connect">Connect Website</button></div>' : '');
    return '<div class="hm-card"><h3>Your activity</h3>' + body + planLine() + '</div>';
  }

  function recent() {
    var r = H.recent, body;
    if (r === null && !H.recentErr) body = '<div class="hm-rc">' + [1, 2, 3].map(function () { return '<div class="hm-sk" style="height:62px"></div>'; }).join('') + '</div>';
    else if (H.recentErr) body = '<div class="hm-empty"><p>Could not load recent conversations right now.</p></div>';
    else if (!r.length) body = '<div class="hm-empty"><div class="big">&#128172;</div><h4>No conversations yet</h4><p>Once customers start chatting with your AI, they\'ll appear here.</p><button type="button" class="hm-btn sm" data-go="connect">Connect your website</button></div>';
    else body = '<div class="hm-rc">' + r.map(function (c) {
      return '<button type="button" class="hm-r" data-conv="' + esc(c.id) + '"><div class="t"><b>' + esc(c.name) + '</b><span>' + esc(ago(c.at)) + '</span></div><div class="q">' + esc(c.text || 'Conversation started') + '</div></button>';
    }).join('') + '</div>';
    return '<div class="hm-card"><h3>Recent conversations' + (r && r.length ? '<button type="button" class="hm-btn sm" data-go="conversations">View all</button>' : '') + '</h3>' + body + '</div>';
  }

  function noAgent() {
    return '<div class="hm"><section class="hm-hero rv" style="grid-template-columns:minmax(0,1fr)"><div><span class="hm-eyebrow">Welcome to Auvii &#128075;</span><h1>Create your AI assistant</h1><p class="lead">Tell Auvii about your business and your AI customer-service assistant is ready to chat. It takes a few minutes and starts with a 7-day free trial.</p><div class="hm-cta"><a class="hm-btn pri" href="create-agent.html">Create AI Agent</a></div></div></section></div>';
  }

  function paint() {
    var root = $('homeRoot'); if (!root) return;
    if (!agent()) { root.innerHTML = noAgent(); return; }
    var L = look();
    var still = H.painted; H.painted = true;
    root.innerHTML = '<div class="hm' + (still ? ' hm-still' : '') + '">' + hero(L) + steps(L) + caps() + quick() + '<div class="hm-two rv d5">' + activity() + recent() + '</div></div>';
    wire(root);
  }

  function wire(root) {
    root.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        var g = b.dataset.go;
        if (/\.html$/.test(g)) { window.location.href = g; return; }
        try { showView(g); window.scrollTo({ top: 0 }); } catch (e) {}
      });
    });
    root.querySelectorAll('[data-conv]').forEach(function (b) {
      b.addEventListener('click', function () {
        try { showView('conversations'); } catch (e) {}
        try { if (typeof openConversation === 'function') openConversation(b.dataset.conv); } catch (e) {}
      });
    });
  }

  /* ---------- data (read-only) ---------- */
  function loadWidget(a, tok) {
    return sb.from('widget_settings').select('*').eq('agent_id', a.id).limit(20).then(function (r) {
      if (tok !== H.token) return;
      var rows = (r && r.data) || [];
      rows.sort(function (x, y) { return new Date(y.updated_at || y.created_at || 0) - new Date(x.updated_at || x.created_at || 0); });
      H.widget = rows[0] || null; paint();
    }).catch(function () {});
  }

  function loadRecent(a, tok) {
    return sb.from('conversations').select('id,customer_name,customer_email,customer_identifier,created_at,last_message_at').eq('agent_id', a.id).order('last_message_at', { ascending: false, nullsFirst: false }).limit(4).then(function (r) {
      if (tok !== H.token) return;
      var rows = (r && r.data) || [];
      if (r && r.error) { H.recentErr = true; paint(); return; }
      if (!rows.length) { H.recent = []; paint(); return; }
      var ids = rows.map(function (c) { return c.id; });
      return sb.from('messages').select('conversation_id,content,created_at').eq('sender', 'customer').in('conversation_id', ids).order('created_at', { ascending: false }).limit(40).then(function (m) {
        if (tok !== H.token) return;
        var last = {}; ((m && m.data) || []).forEach(function (x) { if (!last[x.conversation_id]) last[x.conversation_id] = x.content; });
        H.recent = rows.map(function (c) { return { id: c.id, name: c.customer_name || c.customer_email || 'Customer', at: c.last_message_at || c.created_at, text: last[c.id] || '' }; });
        paint();
      });
    }).catch(function () { H.recentErr = true; paint(); });
  }

  window.AuviiHome = {
    render: function () {
      css();
      var a = agent();
      if (!a) { paint(); return; }
      var tok = ++H.token;
      if (H.agentId !== a.id) { H.agentId = a.id; H.widget = null; H.recent = null; H.recentErr = false; H.stats = null; }
      paint();
      loadWidget(a, tok); loadRecent(a, tok);
    },
    stats: function (c, m, k) { H.stats = { c: c, m: m, k: k }; paint(); }
  };
})();
