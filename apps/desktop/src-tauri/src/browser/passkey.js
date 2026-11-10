(() => {
  const credentials = navigator.credentials;
  if (credentials == null) {
    return;
  }
  const tell = (kind) => {
    const handlers = window.webkit == null ? null : window.webkit.messageHandlers;
    const handler = handlers == null ? null : handlers.goodboyPasskey;
    if (handler == null) {
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
      if (options != null && options.publicKey != null && options.mediation !== 'conditional') {
        tell(kind);
      }
      return original.apply(this, arguments);
    };
  }
})();
