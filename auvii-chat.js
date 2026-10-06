/* Auvii AI Widget - embed script
   Usage: <script src="https://auvii.vercel.app/auvii-chat.js" data-agent="AGENT_ID"></script>
   Or auto-installed via Shopify Script Tags, which can't set data-agent - in that case the
   agent ID is passed as a query param instead: auvii-chat.js?agent=AGENT_ID
   Runs entirely client-side on the STORE OWNER's website (not Auvii's own domain),
   so everything is namespaced inside a Shadow DOM and every network call goes through
   the chat_ai Edge Function - no direct table access, no exposed business logic.
*/
(function () {
  const SCRIPT = document.currentScript;
  let AGENT_ID = SCRIPT && SCRIPT.getAttribute('data-agent');
  if (!AGENT_ID && SCRIPT && SCRIPT.src) {
    try { AGENT_ID = new URL(SCRIPT.src).searchParams.get('agent'); } catch (e) { /* ignore */ }
  }
  if (!AGENT_ID) { console.warn('[Auvii widget] missing agent ID (data-agent attribute or ?agent= query param)'); return; }

  const FUNCTIONS_URL = 'https://aqxdmlyvmjmkdnqkwgot.supabase.co/functions/v1/chat_ai';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxeGRtbHl2bWpta2RucWt3Z290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNTkzODIsImV4cCI6MjEwMzkzNTM4Mn0.gNsY7NbIWhSfvvxohZQWAtJNXf_61-UluSfCjanX780';
  const SESSION_KEY = 'auvii_widget_' + AGENT_ID;
  const MAX_IMG_SIDE = 1024;
  const EFFECTS = ['glow', 'ripple', 'float3d', 'ring', 'tilt3d'];

  function callFn(payload) {
    return fetch(FUNCTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON_KEY },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); });
  }

  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveSession(s) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }

  callFn({ agent_id: AGENT_ID, action: 'init' }).then(function (cfg) {
    if (!cfg || cfg.error) return; // agent missing/disabled - render nothing, fail silently
    buildWidget(cfg);
  }).catch(function () { /* network hiccup - don't break the host site */ });

  function buildWidget(cfg) {
    const isLeft = cfg.position === 'bottom-left';
    const color = cfg.theme_color || '#2F5FFF';
    const S = ({ small: 48, medium: 58, large: 72 })[cfg.size] || 58;          /* bubble size */
    const E = ({ normal: 20, comfortable: 40, high: 70 })[cfg.offset] || 20;   /* gap from the screen edge and bottom */
    const effect = EFFECTS.indexOf(cfg.effect) !== -1 ? cfg.effect : 'none';
    const session = loadSession();
    let history = session.history || [];
    let conversationId = session.conversationId || null;

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    const initial = escapeHtml(((cfg.agent_name || 'A').trim().charAt(0) || 'A').toUpperCase());
    const avatarHtml = cfg.avatar_url
      ? '<img src="' + escapeHtml(cfg.avatar_url) + '" alt="">'
      : '<span class="ini">' + initial + '</span>';

    const host = document.createElement('div');
    host.id = 'auvii-widget-root';
    host.style.cssText = 'position:fixed;bottom:0;' + (isLeft ? 'left:0' : 'right:0') + ';z-index:2147483000;';
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        :host { --c: ${color}; }

        /* ---------- bubble ---------- */
        .dock {
          position: fixed; ${isLeft ? 'left:' + E + 'px' : 'right:' + E + 'px'}; bottom: ${E}px;
          width: ${S}px; height: ${S}px; cursor: pointer; perspective: 700px;
          touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
        }
        .dock.dragging { cursor: grabbing; }
        .bubble {
          position: relative; z-index: 2; width: 100%; height: 100%; border-radius: 50%; background: var(--c);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
          box-shadow: 0 6px 20px rgba(0,0,0,0.25); transition: transform .15s ease, box-shadow .2s ease;
          transform-style: preserve-3d;
        }
        .dock:hover .bubble { transform: scale(1.06); }
        .dock.dragging .bubble { transform: scale(1.1); transition: none; }
        .bubble img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; -webkit-user-drag: none; }
        .bubble .ini { color: #fff; font-weight: 700; font-size: ${Math.round(S * 0.42)}px; }
        .fx { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; z-index: 1; display: none; }

        /* effect: soft pulsing glow */
        .e-glow .bubble { animation: glow 2.2s ease-in-out infinite; }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 55%, transparent), 0 6px 20px rgba(0,0,0,.25); }
          50% { box-shadow: 0 0 0 16px color-mix(in srgb, var(--c) 0%, transparent), 0 0 28px 6px color-mix(in srgb, var(--c) 60%, transparent); }
        }

        /* effect: ripple rings */
        .e-ripple .fx1, .e-ripple .fx2 { display: block; border: 2px solid var(--c); animation: ripple 2.4s ease-out infinite; }
        .e-ripple .fx2 { animation-delay: 1.2s; }
        @keyframes ripple { 0% { transform: scale(1); opacity: .6; } 100% { transform: scale(1.9); opacity: 0; } }

        /* effect: spinning colour ring */
        .e-ring .fx1 {
          display: block; inset: -6px; animation: spin 2.8s linear infinite;
          background: conic-gradient(from 0deg, var(--c), transparent 35%, var(--c) 65%, transparent 90%, var(--c));
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
                  mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* effect: floating 3D orb */
        .e-float3d .bubble {
          animation: float3d 4.2s ease-in-out infinite;
          box-shadow: 0 14px 26px rgba(0,0,0,.35), inset 0 -7px 12px rgba(0,0,0,.28), inset 0 7px 12px rgba(255,255,255,.3);
        }
        .e-float3d .fx1 {
          display: block; inset: auto; left: 16%; right: 16%; bottom: -12px; height: 9px; border-radius: 50%;
          background: rgba(0,0,0,.3); filter: blur(4px); animation: shadowbob 4.2s ease-in-out infinite;
        }
        @keyframes float3d {
          0%, 100% { transform: translateY(0) rotateX(0) rotateY(0); }
          25% { transform: translateY(-6px) rotateX(12deg) rotateY(-16deg); }
          50% { transform: translateY(-2px) rotateX(-8deg) rotateY(0); }
          75% { transform: translateY(-7px) rotateX(10deg) rotateY(16deg); }
        }
        @keyframes shadowbob { 0%, 100% { transform: scaleX(1); opacity: .5; } 50% { transform: scaleX(.8); opacity: .3; } }

        /* effect: 3D tilt that follows the pointer (gentle sway on phones) */
        .e-tilt3d .bubble { box-shadow: 0 12px 24px rgba(0,0,0,.35), inset 0 -6px 12px rgba(0,0,0,.25), inset 0 6px 12px rgba(255,255,255,.28); }
        @media (hover: none) { .e-tilt3d .bubble { animation: sway 5s ease-in-out infinite; } }
        @keyframes sway {
          0%, 100% { transform: rotateY(-16deg) rotateX(6deg); }
          50% { transform: rotateY(16deg) rotateX(-6deg); }
        }

        /* glossy highlight for the two 3D effects */
        .e-float3d .bubble::after, .e-tilt3d .bubble::after {
          content: ""; position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle at 30% 24%, rgba(255,255,255,.55), rgba(255,255,255,0) 46%);
        }
        @media (prefers-reduced-motion: reduce) { .bubble, .fx { animation: none !important; } }

        /* ---------- chat window ---------- */
        .panel {
          position: fixed; display: none; flex-direction: column; background: #fff; overflow: hidden;
          border-radius: 18px; box-shadow: 0 16px 50px rgba(0,0,0,0.28);
        }
        .panel.open { display: flex; }
        .panel.sheet { border-radius: 0; box-shadow: none; }
        .head { background: var(--c); color: #fff; padding: 12px 14px; display: flex; align-items: center; gap: 10px; justify-content: space-between; flex-shrink: 0; }
        .head .who { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .av { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: rgba(255,255,255,.22); display: flex; align-items: center; justify-content: center; }
        .av img { width: 100%; height: 100%; object-fit: cover; }
        .av .ini { color: #fff; font-weight: 700; font-size: 17px; }
        .head .name { font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .head .status { font-size: 11.5px; opacity: .9; display: flex; align-items: center; gap: 5px; }
        .head .status i { width: 7px; height: 7px; border-radius: 50%; background: #5CF2A2; display: inline-block; }
        .close-btn { background: rgba(255,255,255,.18); border: none; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .close-btn svg { width: 17px; height: 17px; }

        .gate { display: none; flex: 1; overflow-y: auto; background: #F1F3F7; padding: 22px 18px; flex-direction: column; justify-content: center; }
        .gate.show { display: flex; }
        .gate .card { background: #fff; border-radius: 16px; padding: 20px 18px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        .gate h3 { margin: 0 0 4px; font-size: 18px; color: #1C1C1E; }
        .gate p { margin: 0 0 14px; font-size: 13.5px; color: #5A5A60; line-height: 1.45; }
        .gate label { display: block; font-size: 12.5px; font-weight: 600; color: #3A3A3F; margin: 0 0 5px; }
        .gate input { width: 100%; border: 1px solid #DDE0E6; border-radius: 12px; padding: 12px 14px; font-size: 16px; outline: none; background: #F7F8FA; margin-bottom: 12px; }
        .gate input:focus { border-color: var(--c); background: #fff; }
        .gate .err { color: #B4281F; font-size: 12.5px; min-height: 16px; margin: -4px 0 8px; }
        .gate .go { width: 100%; border: none; border-radius: 12px; padding: 13px; background: var(--c); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
        .gate .go[disabled] { opacity: .6; cursor: default; }
        .gate .fine { margin: 10px 0 0; font-size: 11.5px; color: #8A8A8E; }

        .body { flex: 1; overflow-y: auto; padding: 14px 12px; background: #F1F3F7; display: flex; flex-direction: column; gap: 10px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        .row { display: flex; align-items: flex-end; gap: 8px; max-width: 100%; }
        .row.customer { justify-content: flex-end; }
        .mav { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: var(--c); display: flex; align-items: center; justify-content: center; }
        .mav img { width: 100%; height: 100%; object-fit: cover; }
        .mav .ini { color: #fff; font-weight: 700; font-size: 12px; }
        .col { display: flex; flex-direction: column; max-width: 78%; min-width: 0; }
        .row.customer .col { align-items: flex-end; }
        .msg { padding: 9px 13px; border-radius: 18px; font-size: 14.5px; line-height: 1.42; white-space: pre-wrap; overflow-wrap: anywhere; }
        .msg.ai { background: #fff; color: #1C1C1E; border-bottom-left-radius: 5px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
        .msg.customer { background: var(--c); color: #fff; border-bottom-right-radius: 5px; }
        .msg .photo { display: block; max-width: 210px; width: 100%; border-radius: 12px; margin: 0 0 6px; }
        .msg.note { background: transparent; color: #8A8A8E; font-size: 12.5px; text-align: center; box-shadow: none; padding: 2px; align-self: center; }
        .time { font-size: 10.5px; color: #9AA0A8; margin: 3px 6px 0; }

        .typing { background: #fff; border-radius: 18px; border-bottom-left-radius: 5px; padding: 12px 14px; display: inline-flex; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
        .typing i { width: 7px; height: 7px; border-radius: 50%; background: #B4B9C2; animation: dot 1.1s infinite ease-in-out; }
        .typing i:nth-child(2) { animation-delay: .15s; } .typing i:nth-child(3) { animation-delay: .3s; }
        @keyframes dot { 0%, 60%, 100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-4px); opacity: 1; } }

        .product-card { background: #fff; border: 1px solid #ECECEC; border-radius: 14px; overflow: hidden; width: 230px; max-width: 100%; align-self: flex-start; margin-left: 36px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
        .product-card .img { height: 120px; background: #F4F5F7; display: flex; align-items: center; justify-content: center; color: #B8B8BC; }
        .product-card .img img { width: 100%; height: 100%; object-fit: cover; }
        .product-card .img svg { width: 34px; height: 34px; }
        .product-card .pbody { padding: 10px 12px 12px; }
        .product-card .name { font-weight: 700; font-size: 13.5px; margin-bottom: 2px; color: #1C1C1E; }
        .product-card .desc { font-size: 11.5px; color: #8A8A8E; margin-bottom: 6px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .product-card .meta-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .product-card .price { font-weight: 700; font-size: 14px; color: var(--c); }
        .product-card .avail { font-size: 10.5px; padding: 2px 7px; border-radius: 10px; font-weight: 600; }
        .product-card .avail.in-stock { background: #E4F5EC; color: #1A7A4C; }
        .product-card .avail.out-of-stock { background: #FDE8E8; color: #B4281F; }
        .product-card .rating { font-size: 11px; color: #8A8A8E; margin-bottom: 6px; }
        .product-card a.view-btn { display: block; text-align: center; background: var(--c); color: #fff; font-size: 13px; font-weight: 600; padding: 9px; border-radius: 9px; text-decoration: none; }

        .foot { background: #fff; border-top: 1px solid #E8EAEE; padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px)); flex-shrink: 0; }
        .preview { display: none; align-items: center; gap: 10px; padding: 4px 4px 8px; }
        .preview.show { display: flex; }
        .preview .thumb { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; border: 1px solid #E1E3E8; }
        .preview span { font-size: 12.5px; color: #5A5A60; flex: 1; }
        .preview button { border: none; background: #EEF0F4; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 16px; line-height: 1; color: #555; }
        .compose { display: flex; align-items: center; gap: 8px; }
        .compose input[type=text] { flex: 1; min-width: 0; border: 1px solid #DDE0E6; border-radius: 22px; padding: 11px 15px; font-size: 16px; outline: none; background: #F7F8FA; }
        .compose input[type=text]:focus { border-color: var(--c); background: #fff; }
        .iconbtn { border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .iconbtn svg { width: 20px; height: 20px; }
        .attach { background: #EEF0F4; color: #555; }
        .send { background: var(--c); }
        .send svg { width: 18px; height: 18px; }
      </style>

      <div class="dock e-${effect}" role="button" tabindex="0" aria-label="Chat with us">
        <span class="fx fx1"></span><span class="fx fx2"></span>
        <div class="bubble">${avatarHtml}</div>
      </div>

      <div class="panel" role="dialog" aria-label="Chat">
        <div class="head">
          <div class="who">
            <div class="av">${avatarHtml}</div>
            <div style="min-width:0"><div class="name">${escapeHtml(cfg.agent_name)}</div><div class="status"><i></i>Online</div></div>
          </div>
          <button class="close-btn" aria-label="Close chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="gate" id="auvii-gate">
          <div class="card">
            <h3>Before we start</h3>
            <p>Tell us who you are so the team can follow up if needed.</p>
            <label for="auvii-name">Your name</label>
            <input id="auvii-name" type="text" autocomplete="name" placeholder="Your name">
            <label for="auvii-email">Your email</label>
            <input id="auvii-email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com">
            <div class="err" id="auvii-err"></div>
            <button type="button" class="go" id="auvii-go">Start chat</button>
            <p class="fine">Your details are shared only with this store.</p>
          </div>
        </div>
        <div class="body" id="auvii-body"></div>
        <div class="foot" id="auvii-foot">
          <div class="preview" id="auvii-preview"><img class="thumb" alt=""><span>Photo ready to send</span><button type="button" id="auvii-unattach" aria-label="Remove photo">&times;</button></div>
          <div class="compose">
            <input type="file" id="auvii-file" accept="image/*" hidden>
            <button type="button" class="iconbtn attach" id="auvii-attach" aria-label="Send a photo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="1.8"/><path d="m21 16-4.6-4.6a1.5 1.5 0 0 0-2.1 0L7 18.5"/></svg>
            </button>
            <input id="auvii-input" type="text" placeholder="Type a message..." autocomplete="off" />
            <button type="button" class="iconbtn send" id="auvii-send" aria-label="Send">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    const dock = root.querySelector('.dock');
    const bubbleBtn = dock; /* the draggable element */
    const bubbleEl = root.querySelector('.bubble');
    const panel = root.querySelector('.panel');
    const closeBtn = root.querySelector('.close-btn');
    const body = root.querySelector('#auvii-body');
    const input = root.querySelector('#auvii-input');
    const sendBtn = root.querySelector('#auvii-send');
    const attachBtn = root.querySelector('#auvii-attach');
    const fileInput = root.querySelector('#auvii-file');
    const previewBox = root.querySelector('#auvii-preview');
    const previewImg = previewBox.querySelector('.thumb');
    const unattachBtn = root.querySelector('#auvii-unattach');
    const gate = root.querySelector('#auvii-gate');
    const foot = root.querySelector('#auvii-foot');
    const nameInput = root.querySelector('#auvii-name');
    const emailInput = root.querySelector('#auvii-email');
    const gateErr = root.querySelector('#auvii-err');
    const goBtn = root.querySelector('#auvii-go');

    /* ---- Visitor details: asked once, then remembered in this browser ---- */
    const CONTACT_KEY = 'auvii_contact_' + AGENT_ID;
    const DEBUG = /auviidebug/i.test(location.search);
    const wantContact = cfg.collect_contact === true;
    let contact = null;
    try { contact = JSON.parse(localStorage.getItem(CONTACT_KEY)); } catch (e) { contact = null; }
    if (!contact || !contact.name || !contact.email) contact = null;

    function needGate() { return wantContact && !contact; }
    function showGate(on) {
      gate.classList.toggle('show', on);
      body.style.display = on ? 'none' : '';
      foot.style.display = on ? 'none' : '';
    }
    showGate(false);

    function submitGate() {
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      if (name.length < 2) { gateErr.textContent = 'Please enter your name.'; nameInput.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { gateErr.textContent = 'Please enter a valid email address.'; emailInput.focus(); return; }
      gateErr.textContent = '';
      goBtn.disabled = true; goBtn.textContent = 'Starting...';
      contact = { name: name, email: email };
      try { localStorage.setItem(CONTACT_KEY, JSON.stringify(contact)); } catch (e) {}
      callFn({ agent_id: AGENT_ID, action: 'start', customer_name: name, customer_email: email }).then(function (d) {
        if (d && d.conversation_id && !conversationId) {
          conversationId = d.conversation_id;
          session.conversationId = conversationId; saveSession(session);
        }
      }).catch(function () { /* the chat still works; details are sent with the first message too */ }).then(function () {
        goBtn.disabled = false; goBtn.textContent = 'Start chat';
        showGate(false);
        scrollDown();
        if (!isSmall()) input.focus();
      });
    }
    goBtn.addEventListener('click', submitGate);
    emailInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitGate(); });
    nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') emailInput.focus(); });

    function nowTime() {
      try { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
    }
    function scrollDown() { body.scrollTop = body.scrollHeight; }

    function addMsg(sender, text, imageUrl) {
      const row = document.createElement('div');
      row.className = 'row ' + sender;
      if (sender === 'ai') {
        const av = document.createElement('div'); av.className = 'mav'; av.innerHTML = avatarHtml; row.appendChild(av);
      }
      const col = document.createElement('div'); col.className = 'col';
      const bub = document.createElement('div'); bub.className = 'msg ' + sender;
      if (imageUrl) { const im = document.createElement('img'); im.className = 'photo'; im.src = imageUrl; im.alt = 'Photo'; bub.appendChild(im); }
      if (text) { const t = document.createElement('div'); t.textContent = text; bub.appendChild(t); }
      col.appendChild(bub);
      const tm = document.createElement('div'); tm.className = 'time'; tm.textContent = nowTime(); col.appendChild(tm);
      row.appendChild(col);
      body.appendChild(row);
      scrollDown();
    }

    function addNote(text) {
      const d = document.createElement('div'); d.className = 'msg note'; d.textContent = text; body.appendChild(d); scrollDown();
    }

    function addProductCard(p) {
      const card = document.createElement('div');
      card.className = 'product-card';
      const availClass = p.availability === 'out_of_stock' ? 'out-of-stock' : 'in-stock';
      const availLabel = p.availability === 'out_of_stock' ? 'Out of stock' : p.availability === 'preorder' ? 'Preorder' : 'In stock';
      card.innerHTML = `
        <div class="img">${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="">` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>`}</div>
        <div class="pbody">
          <div class="name">${escapeHtml(p.name)}</div>
          ${p.description ? `<div class="desc">${escapeHtml(p.description)}</div>` : ''}
          <div class="meta-row">
            <span class="price">${p.price ? escapeHtml(p.price) : ''}</span>
            ${p.availability ? `<span class="avail ${availClass}">${availLabel}</span>` : ''}
          </div>
          ${p.rating ? `<div class="rating">&#9733; ${escapeHtml(p.rating)}</div>` : ''}
          ${p.product_url ? `<a class="view-btn" href="${escapeHtml(p.product_url)}" target="_blank" rel="noopener">View Product</a>` : ''}
        </div>
      `;
      const link = card.querySelector('a.view-btn');
      if (link) {
        link.addEventListener('click', function () {
          callFn({ agent_id: AGENT_ID, action: 'track_click', product_id: p.id, conversation_id: conversationId, event_type: 'product_click' }).catch(function () {});
        });
      }
      body.appendChild(card);
      scrollDown();
    }

    // Restore prior messages in this browser session, or show the welcome message
    if (history.length) {
      history.forEach(function (m) { addMsg(m.role === 'user' ? 'customer' : 'ai', m.content); });
    } else {
      addMsg('ai', cfg.welcome_message);
    }

    /* ---- Open / close ---- */
    const GAP = 8;
    let open = false;
    let savedOverflow = null;
    const isSmall = function () { return window.innerWidth <= 520; };

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    /* Phones: full-screen chat like a messaging app. Larger screens: a window next to the bubble. */
    function placePanel() {
      if (isSmall()) {
        const vv = window.visualViewport;
        const h = vv ? vv.height : window.innerHeight;
        const top = vv ? vv.offsetTop : 0;
        panel.classList.add('sheet');
        panel.style.left = '0'; panel.style.right = '0'; panel.style.width = '100%';
        panel.style.top = top + 'px'; panel.style.bottom = 'auto';
        panel.style.height = h + 'px'; panel.style.maxHeight = 'none';
        return;
      }
      panel.classList.remove('sheet');
      const r = dock.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min(380, vw - GAP * 2);
      const above = r.top - GAP * 2;
      const below = vh - r.bottom - GAP * 2;
      const showAbove = above >= below || above >= 420;
      const h = Math.max(260, Math.min(620, showAbove ? above : below));
      let left = (r.left + r.width / 2 < vw / 2) ? r.left : r.right - w;
      left = clamp(left, GAP, vw - w - GAP);
      panel.style.width = w + 'px';
      panel.style.height = h + 'px';
      panel.style.maxHeight = 'none';
      panel.style.left = left + 'px';
      panel.style.right = 'auto';
      if (showAbove) { panel.style.top = 'auto'; panel.style.bottom = (vh - r.top + GAP) + 'px'; }
      else { panel.style.bottom = 'auto'; panel.style.top = (r.bottom + GAP) + 'px'; }
    }

    function toggle() {
      open = !open;
      panel.classList.toggle('open', open);
      if (open) {
        placePanel();
        const gated = needGate();
        showGate(gated);
        if (isSmall()) {
          dock.style.display = 'none';
          try { savedOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden'; } catch (e) {}
        } else { (gated ? nameInput : input).focus(); }
        scrollDown();
      } else {
        dock.style.display = '';
        try { if (savedOverflow !== null) document.documentElement.style.overflow = savedOverflow; } catch (e) {}
        savedOverflow = null;
      }
    }

    /* ---- Movable bubble: drag it anywhere; a short tap still opens the chat ---- */
    const POS_KEY = 'auvii_pos_' + AGENT_ID;
    let savedPos = null; /* fractions of the free space, so it fits any screen size */
    try { savedPos = JSON.parse(localStorage.getItem(POS_KEY)); } catch (e) { savedPos = null; }

    function setBubbleXY(x, y) {
      x = clamp(x, GAP, Math.max(GAP, window.innerWidth - S - GAP));
      y = clamp(y, GAP, Math.max(GAP, window.innerHeight - S - GAP));
      dock.style.left = x + 'px'; dock.style.top = y + 'px';
      dock.style.right = 'auto'; dock.style.bottom = 'auto';
    }
    function applySavedPos() {
      if (!savedPos || typeof savedPos.fx !== 'number' || typeof savedPos.fy !== 'number') return;
      setBubbleXY(savedPos.fx * (window.innerWidth - S), savedPos.fy * (window.innerHeight - S));
    }

    let drag = null, dragged = false;
    dock.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button > 0) return;
      const r = dock.getBoundingClientRect();
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: r.left, y0: r.top, moved: false };
      dragged = false;
      try { dock.setPointerCapture(e.pointerId); } catch (err) {}
    });
    dock.addEventListener('pointermove', function (e) {
      if (drag && e.pointerId === drag.id) {
        const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 8) return;
        drag.moved = true; dragged = true;
        dock.classList.add('dragging');
        setBubbleXY(drag.x0 + dx, drag.y0 + dy);
        e.preventDefault();
        return;
      }
      /* 3D tilt follows the mouse */
      if (effect === 'tilt3d' && e.pointerType === 'mouse') {
        const r = dock.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        bubbleEl.style.transition = 'transform .08s linear';
        bubbleEl.style.transform = 'rotateX(' + (-py * 34).toFixed(1) + 'deg) rotateY(' + (px * 34).toFixed(1) + 'deg) scale(1.08)';
      }
    });
    dock.addEventListener('pointerleave', function () {
      if (effect === 'tilt3d') { bubbleEl.style.transition = 'transform .25s ease'; bubbleEl.style.transform = ''; }
    });
    function endDrag(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const moved = drag.moved;
      drag = null;
      dock.classList.remove('dragging');
      if (moved) {
        const r = dock.getBoundingClientRect();
        const fw = Math.max(1, window.innerWidth - S), fh = Math.max(1, window.innerHeight - S);
        savedPos = { fx: clamp(r.left / fw, 0, 1), fy: clamp(r.top / fh, 0, 1) };
        try { localStorage.setItem(POS_KEY, JSON.stringify(savedPos)); } catch (err) {}
        setTimeout(function () { dragged = false; }, 0);
      }
    }
    dock.addEventListener('pointerup', endDrag);
    dock.addEventListener('pointercancel', endDrag);
    dock.addEventListener('click', function () { if (dragged) return; toggle(); });
    dock.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    closeBtn.addEventListener('click', toggle);

    function onResize() {
      applySavedPos();
      if (open) {
        placePanel();
        if (isSmall()) dock.style.display = 'none'; else dock.style.display = '';
      }
    }
    window.addEventListener('resize', onResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () { if (open) { placePanel(); scrollDown(); } });
      window.visualViewport.addEventListener('scroll', function () { if (open) placePanel(); });
    }
    applySavedPos();

    /* ---- Photos: the customer can send a picture and the AI looks at it ---- */
    let pendingImage = null;

    function shrinkImage(file) {
      return new Promise(function (resolve, reject) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
          let w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) { URL.revokeObjectURL(url); reject(new Error('empty')); return; }
          const k = Math.min(1, MAX_IMG_SIDE / Math.max(w, h));
          w = Math.round(w * k); h = Math.round(h * k);
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          let q = 0.82, out = c.toDataURL('image/jpeg', q);
          while (out.length > 1400000 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
          resolve(out);
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad image')); };
        img.src = url;
      });
    }

    function clearPending() {
      pendingImage = null;
      previewBox.classList.remove('show');
      previewImg.removeAttribute('src');
    }

    attachBtn.addEventListener('click', function () { fileInput.click(); });
    unattachBtn.addEventListener('click', clearPending);
    fileInput.addEventListener('change', function () {
      const f = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      if (!/^image\//i.test(f.type)) { addNote('Please choose a photo (JPG, PNG or WEBP).'); return; }
      shrinkImage(f).then(function (dataUrl) {
        pendingImage = dataUrl;
        previewImg.src = dataUrl;
        previewBox.classList.add('show');
        input.focus();
      }).catch(function () { addNote("Sorry, I couldn't read that photo. Please try another one."); });
    });

    /* ---- Sending ---- */
    let sending = false;
    function send() {
      const text = input.value.trim();
      const image = pendingImage;
      if ((!text && !image) || sending) return;
      sending = true;
      addMsg('customer', text, image);
      input.value = '';
      clearPending();

      const typingRow = document.createElement('div');
      typingRow.className = 'row ai';
      typingRow.innerHTML = '<div class="mav">' + avatarHtml + '</div><div class="typing"><i></i><i></i><i></i></div>';
      body.appendChild(typingRow);
      scrollDown();

      const payload = {
        agent_id: AGENT_ID,
        message: text,
        history: history,
        conversation_id: conversationId,
        customer_identifier: session.customerId || ('visitor_' + Math.random().toString(36).slice(2, 10)),
      };
      if (image) payload.image = image;
      if (contact) {
        payload.customer_name = contact.name;
        payload.customer_email = contact.email;
        payload.customer_identifier = contact.email;
      }

      callFn(payload).then(function (data) {
        typingRow.remove();
        sending = false;
        if (!data || data.error || !data.reply) {
          const detail = data && data.error ? String(data.error) : 'no reply';
          if (DEBUG) console.warn('[Auvii widget] chat error:', detail);
          let msg = image
            ? "Sorry, I couldn't look at that photo just now. You can describe it in words and I'll help."
            : "Sorry, I'm having trouble responding right now.";
          if (data && data.error && /^That photo/.test(String(data.error))) msg = String(data.error);
          if (DEBUG) msg += ' [' + detail.slice(0, 160) + ']';
          addMsg('ai', msg);
          return;
        }
        addMsg('ai', data.reply);
        if (DEBUG && data.photo_model) addNote('[photo read by ' + data.photo_model + ']');
        if (Array.isArray(data.products) && data.products.length) {
          data.products.forEach(function (p) { addProductCard(p); });
        }
        history.push({ role: 'user', content: text || '[photo]' });
        history.push({ role: 'assistant', content: data.reply });
        conversationId = data.conversation_id || conversationId;
        session.history = history.slice(-20);
        session.conversationId = conversationId;
        session.customerId = session.customerId || ('visitor_' + Math.random().toString(36).slice(2, 10));
        saveSession(session);
      }).catch(function (err) {
        typingRow.remove();
        sending = false;
        addMsg('ai', "Sorry, I'm having trouble responding right now." + (DEBUG ? ' [network: ' + (err && err.message) + ']' : ''));
      });
    }
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  }
})();
