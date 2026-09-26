(() => {
  const host = window.parent;
  if (host === window) {
    return;
  }
  const post = (message) => host.postMessage({ channel: 'gbframe', ...message }, '*');
  const pagePath = () => location.pathname.split('/').filter(Boolean).slice(1).join('/');
  const byId = (nodeId) => document.querySelector(`[data-node="${CSS.escape(nodeId)}"]`);
  let revealed = null;
  let revealTimer = 0;
  const reveal = (nodeId) => {
    const node = byId(nodeId);
    if (node === null) {
      return;
    }
    if (revealed !== null) {
      revealed.classList.remove('gb-reveal');
    }
    window.clearTimeout(revealTimer);
    revealed = node;
    node.classList.add('gb-reveal');
    node.scrollIntoView({ block: 'center', inline: 'nearest' });
    revealTimer = window.setTimeout(() => node.classList.remove('gb-reveal'), 1600);
  };
  window.addEventListener('message', (event) => {
    if (event.source !== host) {
      return;
    }
    const data = event.data;
    if (data === null || typeof data !== 'object' || data.channel !== 'goodboy') {
      return;
    }
    if (data.type === 'reveal' && typeof data.nodeId === 'string') {
      reveal(data.nodeId);
    }
    if (data.type === 'variant') {
      const root = document.documentElement;
      if (typeof data.variantId === 'string') {
        root.setAttribute('data-variant', data.variantId);
      }
      if (data.variantId === null) {
        root.removeAttribute('data-variant');
      }
    }
  });
  const announce = () => {
    const height = document.documentElement.scrollHeight;
    post({ type: 'navigated', path: pagePath(), height });
  };
  if (document.readyState !== 'complete') {
    window.addEventListener('load', announce);
  }
  if (document.readyState === 'complete') {
    announce();
  }
})();
