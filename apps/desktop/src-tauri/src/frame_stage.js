(() => {
  const host = window.parent;
  if (host === window) {
    return;
  }
  const post = (message) => host.postMessage({ channel: 'gbframe', ...message }, '*');
  const pagePath = () => location.pathname.split('/').filter(Boolean).slice(1).join('/');
  const byId = (nodeId) => document.querySelector(`[data-node="${CSS.escape(nodeId)}"]`);
  const nodeOf = (target) => (target instanceof Element ? target.closest('[data-node]') : null);
  const labelOf = (node) => {
    const text = (node.getAttribute('aria-label') || node.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 48);
    return text.length > 0 ? text : node.getAttribute('data-node');
  };
  let picking = false;
  let hovered = null;
  const unhover = () => {
    if (hovered !== null) {
      hovered.classList.remove('gb-pick-hover');
    }
    hovered = null;
  };
  const setPicking = (isOn) => {
    picking = isOn;
    if (!isOn) {
      unhover();
    }
  };
  document.addEventListener(
    'mouseover',
    (event) => {
      if (!picking) {
        return;
      }
      const node = nodeOf(event.target);
      if (node === hovered) {
        return;
      }
      unhover();
      if (node !== null) {
        node.classList.add('gb-pick-hover');
        hovered = node;
      }
    },
    true,
  );
  document.addEventListener(
    'click',
    (event) => {
      if (!picking) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const node = nodeOf(event.target);
      if (node !== null) {
        post({ type: 'picked', nodeId: node.getAttribute('data-node'), label: labelOf(node) });
      }
    },
    true,
  );
  document.addEventListener('keydown', (event) => {
    if (picking && event.key === 'Escape') {
      setPicking(false);
      post({ type: 'pickEnded' });
    }
  });
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
    if (data.type === 'pick') {
      setPicking(data.isOn === true);
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
