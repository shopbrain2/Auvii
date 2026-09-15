/* Auvii AI Widget — embed script
   Usage: <script src="https://shopbrain2.github.io/shopbrain/sb-chat.js" data-agent="AGENT_ID"></script>
   Or auto-installed via Shopify Script Tags, which can't set data-agent — in that case the
   agent ID is passed as a query param instead: sb-chat.js?agent=AGENT_ID
   Runs entirely client-side on the STORE OWNER's website (not Auvii's own domain),
   so everything is namespaced inside a Shadow DOM and every network call goes through
   the chat_ai Edge Function — no direct table access, no exposed business logic.
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
  const SESSION_KEY = 'sb_widget_' + AGENT_ID;

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
    if (!cfg || cfg.error) return; // agent missing/disabled — render nothing, fail silently
    buildWidget(cfg);
  }).catch(function () { /* network hiccup — don't break the host site */ });

  function buildWidget(cfg) {
    const isLeft = cfg.position === 'bottom-left';
    const color = cfg.theme_color || '#2F5FFF';
    const session = loadSession();
    let history = session.history || [];
    let conversationId = session.conversationId || null;

    const host = document.createElement('div');
    host.id = 'shopbrain-widget-root';
    host.style.cssText = 'position:fixed;bottom:0;' + (isLeft ? 'left:0' : 'right:0') + ';z-index:2147483000;';
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .bubble {
          position: fixed; ${isLeft ? 'left:20px' : 'right:20px'}; bottom: 20px;
          width: 58px; height: 58px; border-radius: 50%; background: ${color};
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          box-shadow: 0 6px 20px rgba(0,0,0,0.25); border: none; transition: transform .15s ease;
          overflow: hidden; padding: 0;
        }
        .bubble:hover { transform: scale(1.06); }
        .bubble svg { width: 26px; height: 26px; }
        .bubble img { width: 100%; height: 100%; object-fit: cover; }
        .panel {
          position: fixed; ${isLeft ? 'left:20px' : 'right:20px'}; bottom: 90px;
          width: 340px; max-width: calc(100vw - 40px); height: 480px; max-height: calc(100vh - 140px);
          background: #fff; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.22);
          display: none; flex-direction: column; overflow: hidden;
        }
        .panel.open { display: flex; }
        .head { background: ${color}; color: #fff; padding: 16px 18px; display:flex; align-items:center; gap:10px; justify-content:space-between; }
        .head .who { display:flex; align-items:center; gap:10px; min-width:0; }
        .head .avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: rgba(255,255,255,0.2); }
        .head .name { font-weight: 700; font-size: 14.5px; }
        .head .status { font-size: 11.5px; opacity: 0.85; }
        .head button { background: none; border: none; color: #fff; opacity: 0.85; cursor: pointer; padding: 4px; flex-shrink:0; }
        .body { flex: 1; overflow-y: auto; padding: 14px; background: #F7F8FA; display:flex; flex-direction:column; gap:10px; }
        .msg { max-width: 82%; padding: 9px 13px; border-radius: 14px; font-size: 13.5px; line-height:1.4; white-space:pre-wrap; }
        .msg.ai { background: #fff; border: 1px solid #ECECEC; align-self: flex-start; border-bottom-left-radius:4px; color:#1C1C1E; }
        .msg.customer { background: ${color}; color: #fff; align-self: flex-end; border-bottom-right-radius:4px; }
        .product-card { align-self: flex-start; max-width: 88%; background: #fff; border: 1px solid #ECECEC; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .product-card .img { width: 100%; height: 120px; background: #F3F3F3; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .product-card .img img { width: 100%; height: 100%; object-fit: cover; }
        .product-card .img svg { width: 32px; height: 32px; stroke: #C4C4C4; }
        .product-card .body { padding: 10px 12px; }
        .product-card .name { font-weight: 700; font-size: 13px; margin-bottom: 2px; color: #1C1C1E; }
        .product-card .desc { font-size: 11.5px; color: #8A8A8E; margin-bottom: 6px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .product-card .meta-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .product-card .price { font-weight: 700; font-size: 13.5px; color: ${color}; }
        .product-card .avail { font-size: 10.5px; padding: 2px 7px; border-radius: 10px; font-weight: 600; }
        .product-card .avail.in-stock { background: #E4F5EC; color: #1A7A4C; }
        .product-card .avail.out-of-stock { background: #FFEDE6; color: #B5431F; }
        .product-card .rating { font-size: 11px; color: #8A8A8E; }
        .product-card a.view-btn { display: block; text-align: center; background: ${color}; color: #fff; font-size: 12.5px; font-weight: 600; padding: 8px; border-radius: 8px; text-decoration: none; }
        .typing { align-self:flex-start; font-size:12px; color:#8A8A8E; padding:2px 4px; }
        .foot { border-top: 1px solid #EEE; padding: 10px; display: flex; gap: 8px; background:#fff; }
        .foot input { flex: 1; border: 1px solid #DDD; border-radius: 20px; padding: 9px 14px; font-size: 13.5px; outline: none; }
        .foot input:focus { border-color: ${color}; }
        .foot button { background: ${color}; border: none; border-radius: 50%; width: 36px; height: 36px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
        .foot button svg { width:16px; height:16px; }
        .badge { position:absolute; bottom:44px; ${isLeft ? 'left:0' : 'right:0'}; font-size:9px; color:#B8B8BC; text-align:center; width:58px; }
      </style>
      <button class="bubble" aria-label="Chat with us">
        ${cfg.avatar_url ? `<img src="${escapeHtml(cfg.avatar_url)}" alt="">` : `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`}
      </button>
      <div class="panel">
        <div class="head">
          <div class="who">
            ${cfg.avatar_url ? `<img class="avatar" src="${escapeHtml(cfg.avatar_url)}" alt="">` : ''}
            <div><div class="name">${escapeHtml(cfg.agent_name)}</div><div class="status">● Online</div></div>
          </div>
          <button class="close-btn" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="body" id="sb-body"></div>
        <div class="foot">
          <input id="sb-input" type="text" placeholder="Type a message…" />
          <button id="sb-send" aria-label="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
          </button>
        </div>
      </div>
    `;

    const bubbleBtn = root.querySelector('.bubble');
    const panel = root.querySelector('.panel');
    const closeBtn = root.querySelector('.close-btn');
    const body = root.querySelector('#sb-body');
    const input = root.querySelector('#sb-input');
    const sendBtn = root.querySelector('#sb-send');

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function addMsg(sender, text) {
      const div = document.createElement('div');
      div.className = 'msg ' + sender;
      div.textContent = text;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }

    function addProductCard(p) {
      const card = document.createElement('div');
      card.className = 'product-card';
      const availClass = p.availability === 'out_of_stock' ? 'out-of-stock' : 'in-stock';
      const availLabel = p.availability === 'out_of_stock' ? 'Out of stock' : p.availability === 'preorder' ? 'Preorder' : 'In stock';
      card.innerHTML = `
        <div class="img">${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="">` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`}</div>
        <div class="body">
          <div class="name">${escapeHtml(p.name)}</div>
          ${p.description ? `<div class="desc">${escapeHtml(p.description)}</div>` : ''}
          <div class="meta-row">
            <span class="price">${p.price ? escapeHtml(p.price) : ''}</span>
            ${p.availability ? `<span class="avail ${availClass}">${availLabel}</span>` : ''}
          </div>
          ${p.rating ? `<div class="rating">★ ${p.rating}</div>` : ''}
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
      body.scrollTop = body.scrollHeight;
    }

    // Restore prior messages in this browser session, or show the welcome message
    if (history.length) {
      history.forEach(function (m) { addMsg(m.role === 'user' ? 'customer' : 'ai', m.content); });
    } else {
      addMsg('ai', cfg.welcome_message);
    }

    let open = false;
    function toggle() {
      open = !open;
      panel.classList.toggle('open', open);
      if (open) input.focus();
    }
    bubbleBtn.addEventListener('click', toggle);
    closeBtn.addEventListener('click', toggle);

    let sending = false;
    function send() {
      const text = input.value.trim();
      if (!text || sending) return;
      sending = true;
      addMsg('customer', text);
      input.value = '';
      const typingEl = document.createElement('div');
      typingEl.className = 'typing';
      typingEl.textContent = cfg.agent_name + ' is typing…';
      body.appendChild(typingEl);
      body.scrollTop = body.scrollHeight;

      callFn({
        agent_id: AGENT_ID,
        message: text,
        history: history,
        conversation_id: conversationId,
        customer_identifier: session.customerId || ('visitor_' + Math.random().toString(36).slice(2, 10)),
      }).then(function (data) {
        typingEl.remove();
        sending = false;
        if (data.error) { addMsg('ai', "Sorry, I'm having trouble responding right now."); return; }
        addMsg('ai', data.reply);
        if (Array.isArray(data.products) && data.products.length) {
          data.products.forEach(function (p) { addProductCard(p); });
        }
        history.push({ role: 'user', content: text });
        history.push({ role: 'assistant', content: data.reply });
        conversationId = data.conversation_id || conversationId;
        session.history = history.slice(-20);
        session.conversationId = conversationId;
        session.customerId = session.customerId || ('visitor_' + Math.random().toString(36).slice(2, 10));
        saveSession(session);
      }).catch(function () {
        typingEl.remove();
        sending = false;
        addMsg('ai', "Sorry, I'm having trouble responding right now.");
      });
    }
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  }
})();
