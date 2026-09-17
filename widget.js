/* Auvii AI Widget
   Usage:
   <script src="https://auvii.vercel.app/widget.js" data-agent="AGENT_ID"></script>

   Shopify / script-tag usage:
   https://auvii.vercel.app/widget.js?agent=AGENT_ID

   The widget runs on the store owner's website.
   All AI requests go through the Auvii Supabase Edge Function.
*/

(function () {
  'use strict';

  const SCRIPT = document.currentScript;

  let AGENT_ID = SCRIPT && SCRIPT.getAttribute('data-agent');

  if (!AGENT_ID && SCRIPT && SCRIPT.src) {
    try {
      AGENT_ID = new URL(SCRIPT.src).searchParams.get('agent');
    } catch (e) {}
  }

  if (!AGENT_ID) {
    console.warn('[Auvii] Missing agent ID.');
    return;
  }

  const FUNCTIONS_URL =
    'https://aqxdmlyvmjmkdnqkwgot.supabase.co/functions/v1/chat_ai';

  const ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxeGRtbHl2bWpta2RucWt3Z290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNTkzODIsImV4cCI6MjEwMzkzNTM4Mn0.gNsY7NbIWhSfvvxohZQWAtJNXf_61-UluSfCjanX780';

  const SESSION_KEY = 'auvii_widget_' + AGENT_ID;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(
      /[&<>"']/g,
      function (char) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[char];
      }
    );
  }

  function callAuvii(payload) {
    return fetch(FUNCTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ANON_KEY
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json();
    });
  }

  function loadSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveSession(session) {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify(session)
      );
    } catch (e) {}
  }

  const session = loadSession();

  let history = Array.isArray(session.history)
    ? session.history
    : [];

  let conversationId = session.conversationId || null;

  const customerId =
    session.customerId ||
    'visitor_' + Math.random().toString(36).slice(2, 10);

  session.customerId = customerId;
  saveSession(session);

  callAuvii({
    agent_id: AGENT_ID,
    action: 'init'
  })
    .then(function (config) {
      if (!config || config.error) {
        console.warn('[Auvii] Agent could not be initialized.');
        return;
      }

      buildWidget(config);
    })
    .catch(function (error) {
      console.warn('[Auvii] Widget initialization failed.', error);
    });

  function buildWidget(config) {
    if (document.getElementById('auvii-widget-root')) {
      return;
    }

    const position =
      config.position === 'bottom-left'
        ? 'left'
        : 'right';

    const color =
      config.theme_color || '#2F5FFF';

    const agentName =
      config.agent_name || 'Auvii Assistant';

    const welcomeMessage =
      config.welcome_message ||
      'Hi! 👋 How can I help you today?';

    const host = document.createElement('div');

    host.id = 'auvii-widget-root';

    host.style.cssText =
      'position:fixed;' +
      'bottom:0;' +
      position +
      ':0;' +
      'z-index:2147483000;';

    document.body.appendChild(host);

    const root = host.attachShadow({
      mode: 'open'
    });

    root.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            Arial,
            sans-serif;
        }

        .auvii-bubble {
          position: fixed;
          ${position}: 20px;
          bottom: 20px;

          width: 58px;
          height: 58px;

          border: 0;
          border-radius: 50%;

          background: ${escapeHtml(color)};

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;

          box-shadow:
            0 6px 20px rgba(0,0,0,.25);

          transition:
            transform .15s ease,
            box-shadow .15s ease;

          padding: 0;
        }

        .auvii-bubble:hover {
          transform: scale(1.06);
          box-shadow:
            0 8px 25px rgba(0,0,0,.30);
        }

        .auvii-bubble svg {
          width: 27px;
          height: 27px;
        }

        .auvii-bubble img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .auvii-panel {
          position: fixed;
          ${position}: 20px;
          bottom: 90px;

          width: 350px;
          max-width: calc(100vw - 30px);

          height: 500px;
          max-height: calc(100vh - 120px);

          background: #fff;

          border-radius: 18px;

          box-shadow:
            0 15px 45px rgba(0,0,0,.23);

          overflow: hidden;

          display: none;
          flex-direction: column;
        }

        .auvii-panel.open {
          display: flex;
        }

        .auvii-header {
          background: ${escapeHtml(color)};
          color: white;

          padding: 15px 16px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 10px;
        }

        .auvii-person {
          display: flex;
          align-items: center;
          gap: 10px;

          min-width: 0;
        }

        .auvii-avatar {
          width: 38px;
          height: 38px;

          border-radius: 50%;

          object-fit: cover;

          background:
            rgba(255,255,255,.2);

          flex-shrink: 0;
        }

        .auvii-avatar-fallback {
          width: 38px;
          height: 38px;

          border-radius: 50%;

          background:
            rgba(255,255,255,.2);

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;
        }

        .auvii-name {
          font-weight: 700;
          font-size: 14px;

          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .auvii-status {
          font-size: 11px;
          opacity: .85;

          margin-top: 2px;
        }

        .auvii-close {
          background: none;
          border: 0;

          color: white;

          cursor: pointer;

          padding: 5px;

          display: flex;
        }

        .auvii-close svg {
          width: 20px;
          height: 20px;
        }

        .auvii-body {
          flex: 1;

          overflow-y: auto;

          padding: 14px;

          background: #F7F8FA;

          display: flex;
          flex-direction: column;

          gap: 9px;
        }

        .auvii-message {
          max-width: 82%;

          padding: 9px 13px;

          border-radius: 14px;

          font-size: 13.5px;
          line-height: 1.45;

          white-space: pre-wrap;

          word-break: break-word;
        }

        .auvii-message.ai {
          align-self: flex-start;

          background: white;

          color: #1C1C1E;

          border: 1px solid #ECECEC;

          border-bottom-left-radius: 4px;
        }

        .auvii-message.customer {
          align-self: flex-end;

          background: ${escapeHtml(color)};

          color: white;

          border-bottom-right-radius: 4px;
        }

        .auvii-typing {
          align-self: flex-start;

          color: #8A8A8E;

          font-size: 12px;

          padding: 3px 4px;
        }

        .auvii-footer {
          border-top: 1px solid #eee;

          padding: 10px;

          background: white;

          display: flex;

          gap: 8px;
        }

        .auvii-input {
          flex: 1;

          min-width: 0;

          border: 1px solid #ddd;

          border-radius: 22px;

          padding: 10px 14px;

          font-size: 13.5px;

          outline: none;
        }

        .auvii-input:focus {
          border-color: ${escapeHtml(color)};
        }

        .auvii-send {
          width: 38px;
          height: 38px;

          border: 0;
          border-radius: 50%;

          background: ${escapeHtml(color)};

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;

          flex-shrink: 0;
        }

        .auvii-send:disabled {
          opacity: .55;
          cursor: default;
        }

        .auvii-send svg {
          width: 17px;
          height: 17px;
        }

        .auvii-product {
          align-self: flex-start;

          width: 88%;

          background: white;

          border: 1px solid #e7e7e7;

          border-radius: 13px;

          overflow: hidden;

          box-shadow:
            0 2px 8px rgba(0,0,0,.06);
        }

        .auvii-product-image {
          width: 100%;
          height: 125px;

          background: #f3f3f3;

          display: flex;
          align-items: center;
          justify-content: center;

          overflow: hidden;
        }

        .auvii-product-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .auvii-product-content {
          padding: 10px 12px;
        }

        .auvii-product-name {
          font-weight: 700;

          font-size: 13px;

          color: #1c1c1e;

          margin-bottom: 4px;
        }

        .auvii-product-description {
          font-size: 11.5px;

          color: #8a8a8e;

          line-height: 1.35;

          margin-bottom: 7px;
        }

        .auvii-product-row {
          display: flex;

          justify-content: space-between;
          align-items: center;

          gap: 8px;

          margin-bottom: 8px;
        }

        .auvii-price {
          color: ${escapeHtml(color)};

          font-weight: 700;

          font-size: 13.5px;
        }

        .auvii-stock {
          font-size: 10px;

          font-weight: 600;

          padding: 3px 7px;

          border-radius: 10px;

          background: #E4F5EC;

          color: #1A7A4C;
        }

        .auvii-stock.out {
          background: #FFEDE6;

          color: #B5431F;
        }

        .auvii-product-button {
          display: block;

          text-align: center;

          text-decoration: none;

          background: ${escapeHtml(color)};

          color: white;

          font-size: 12px;

          font-weight: 600;

          padding: 9px;

          border-radius: 8px;
        }

        @media (max-width: 480px) {
          .auvii-panel {
            ${position}: 10px;
            bottom: 80px;

            width: calc(100vw - 20px);

            height: min(500px, calc(100vh - 100px));

            border-radius: 16px;
          }

          .auvii-bubble {
            ${position}: 15px;
            bottom: 15px;
          }
        }
      </style>

      <button
        class="auvii-bubble"
        aria-label="Chat with ${escapeHtml(agentName)}"
      >
        ${
          config.avatar_url
            ? `
              <img
                src="${escapeHtml(config.avatar_url)}"
                alt=""
              >
            `
            : `
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            `
        }
      </button>

      <div class="auvii-panel">

        <div class="auvii-header">

          <div class="auvii-person">

            ${
              config.avatar_url
                ? `
                  <img
                    class="auvii-avatar"
                    src="${escapeHtml(config.avatar_url)}"
                    alt=""
                  >
                `
                : `
                  <div class="auvii-avatar-fallback">
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="white"
                      stroke-width="2"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                `
            }

            <div>
              <div class="auvii-name">
                ${escapeHtml(agentName)}
              </div>

              <div class="auvii-status">
                ● Online
              </div>
            </div>

          </div>

          <button
            class="auvii-close"
            aria-label="Close chat"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>

        </div>

        <div class="auvii-body"></div>

        <div class="auvii-footer">

          <input
            class="auvii-input"
            type="text"
            placeholder="Type a message..."
            autocomplete="off"
          >

          <button
            class="auvii-send"
            aria-label="Send message"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z"/>
            </svg>
          </button>

        </div>

      </div>
    `;

    const bubble = root.querySelector('.auvii-bubble');
    const panel = root.querySelector('.auvii-panel');
    const closeButton = root.querySelector('.auvii-close');
    const body = root.querySelector('.auvii-body');
    const input = root.querySelector('.auvii-input');
    const sendButton = root.querySelector('.auvii-send');

    function addMessage(type, text) {
      const message = document.createElement('div');

      message.className =
        'auvii-message ' + type;

      message.textContent = text || '';

      body.appendChild(message);

      body.scrollTop = body.scrollHeight;
    }

    function addProduct(product) {
      if (!product) return;

      const card =
        document.createElement('div');

      card.className =
        'auvii-product';

      const outOfStock =
        product.availability === 'out_of_stock';

      const stockText =
        outOfStock
          ? 'Out of stock'
          : product.availability === 'preorder'
            ? 'Preorder'
            : 'In stock';

      card.innerHTML = `
        <div class="auvii-product-image">

          ${
            product.image_url
              ? `
                <img
                  src="${escapeHtml(product.image_url)}"
                  alt=""
                >
              `
              : `
                <svg
                  viewBox="0 0 24 24"
                  width="34"
                  height="34"
                  fill="none"
                  stroke="#c4c4c4"
                  stroke-width="1.5"
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                  />
                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"
                  />
                  <path d="m21 15-5-5L5 21"/>
                </svg>
              `
          }

        </div>

        <div class="auvii-product-content">

          <div class="auvii-product-name">
            ${escapeHtml(product.name)}
          </div>

          ${
            product.description
              ? `
                <div class="auvii-product-description">
                  ${escapeHtml(product.description)}
                </div>
              `
              : ''
          }

          <div class="auvii-product-row">

            ${
              product.price
                ? `
                  <span class="auvii-price">
                    ${escapeHtml(product.price)}
                  </span>
                `
                : ''
            }

            ${
              product.availability
                ? `
                  <span class="auvii-stock ${outOfStock ? 'out' : ''}">
                    ${stockText}
                  </span>
                `
                : ''
            }

          </div>

          ${
            product.product_url
              ? `
                <a
                  class="auvii-product-button"
                  href="${escapeHtml(product.product_url)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Product
                </a>
              `
              : ''
          }

        </div>
      `;

      const productLink =
        card.querySelector('.auvii-product-button');

      if (productLink) {
        productLink.addEventListener(
          'click',
          function () {
            callAuvii({
              agent_id: AGENT_ID,
              action: 'track_click',
              product_id: product.id,
              conversation_id: conversationId,
              event_type: 'product_click'
            }).catch(function () {});
          }
        );
      }

      body.appendChild(card);

      body.scrollTop = body.scrollHeight;
    }

    if (history.length) {
      history.forEach(function (message) {
        addMessage(
          message.role === 'user'
            ? 'customer'
            : 'ai',
          message.content
        );
      });
    } else {
      addMessage('ai', welcomeMessage);
    }

    let isOpen = false;

    function toggleChat() {
      isOpen = !isOpen;

      panel.classList.toggle(
        'open',
        isOpen
      );

      if (isOpen) {
        setTimeout(function () {
          input.focus();
        }, 50);
      }
    }

    bubble.addEventListener(
      'click',
      toggleChat
    );

    closeButton.addEventListener(
      'click',
      toggleChat
    );

    let sending = false;

    function sendMessage() {
      const text =
        input.value.trim();

      if (!text || sending) {
        return;
      }

      sending = true;

      sendButton.disabled = true;

      addMessage(
        'customer',
        text
      );

      input.value = '';

      const typing =
        document.createElement('div');

      typing.className =
        'auvii-typing';

      typing.textContent =
        agentName + ' is typing...';

      body.appendChild(typing);

      body.scrollTop =
        body.scrollHeight;

      callAuvii({
        agent_id: AGENT_ID,
        message: text,
        history: history,
        conversation_id: conversationId,
        customer_identifier: customerId
      })
        .then(function (data) {

          if (typing.parentNode) {
            typing.remove();
          }

          sending = false;

          sendButton.disabled = false;

          if (!data || data.error) {
            addMessage(
              'ai',
              "Sorry, I'm having trouble responding right now."
            );
            return;
          }

          addMessage(
            'ai',
            data.reply || ''
          );

          if (
            Array.isArray(data.products) &&
            data.products.length
          ) {
            data.products.forEach(
              addProduct
            );
          }

          history.push({
            role: 'user',
            content: text
          });

          history.push({
            role: 'assistant',
            content: data.reply || ''
          });

          history =
            history.slice(-20);

          conversationId =
            data.conversation_id ||
            conversationId;

          session.history =
            history;

          session.conversationId =
            conversationId;

          saveSession(session);

        })
        .catch(function () {

          if (typing.parentNode) {
            typing.remove();
          }

          sending = false;

          sendButton.disabled = false;

          addMessage(
            'ai',
            "Sorry, I'm having trouble responding right now."
          );
        });
    }

    sendButton.addEventListener(
      'click',
      sendMessage
    );

    input.addEventListener(
      'keydown',
      function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          sendMessage();
        }
      }
    );
  }

})();