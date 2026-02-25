// src/session.ts
var SESSION_KEY = "__bugscoutai_session_id";
function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// src/transport.ts
var buffer = [];
var config;
function initTransport(cfg) {
  config = cfg;
  setInterval(flush, cfg.flushInterval || 5e3);
}
function enqueue(event) {
  buffer.push(event);
}
function flush() {
  if (!buffer.length) return;
  const payload = {
    session_id: getSessionId(),
    events: buffer.splice(0, buffer.length),
    api_key: config.apiKey
  };
  const url = `${config.apiHost}/ingest`;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey
    },
    body: JSON.stringify(payload)
  }).catch(() => {
    buffer.unshift(...payload.events);
  });
}

// src/capture.ts
function startCapture() {
  enqueue({
    type: "page_view",
    timestamp: Date.now(),
    meta: { url: location.pathname }
  });
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!target) return;
    enqueue({
      type: "click",
      timestamp: Date.now(),
      meta: {
        tag: target.tagName,
        selector: getSelector(target)
      }
    });
  });
}
function getSelector(el) {
  if (el.id) return `#${el.id}`;
  if (el.className) return `.${el.className}`;
  return el.tagName.toLowerCase();
}

// src/init.ts
function init(config2) {
  if (!config2.apiKey) {
    console.warn("[bugScoutAI] apiKey is required");
    return;
  }
  config2.apiHost || (config2.apiHost = "http://localhost:3000");
  initTransport(config2);
  startCapture();
}

// src/index.ts
var index_default = { init };
export {
  index_default as default,
  init
};
