"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default,
  init: () => init
});
module.exports = __toCommonJS(index_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  init
});
