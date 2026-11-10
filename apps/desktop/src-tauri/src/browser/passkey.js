(() => {
  const credentials = navigator.credentials;
  if (credentials == null) {
    return;
  }
  const RETRIES = 20;
  const RETRY_MS = 100;
  const isPasskeyAsk = (options) => {
    try {
      return options != null && options.publicKey != null && options.mediation !== 'conditional';
    } catch {
      return false;
    }
  };
  const handlerOf = () => {
    try {
      const handlers = window.webkit == null ? null : window.webkit.messageHandlers;
      return handlers == null ? null : handlers.goodboyPasskey;
    } catch {
      return null;
    }
  };
  const tell = (kind, attempt) => {
    const handler = handlerOf();
    if (handler == null) {
      if (attempt < RETRIES) {
        setTimeout(() => tell(kind, attempt + 1), RETRY_MS);
      }
      return;
    }
    try {
      handler.postMessage(kind);
    } catch {
      return;
    }
  };
  for (const kind of ['get', 'create']) {
    const original = credentials[kind];
    if (typeof original !== 'function') {
      continue;
    }
    credentials[kind] = function (options) {
      if (isPasskeyAsk(options)) {
        tell(kind, 0);
      }
      return original.apply(this, arguments);
    };
  }
})();
