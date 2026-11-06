export const SHOWN_HELPER = `const isShown = (node) => {
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && node.closest('[hidden]') === null;
  };
  const describe = (node) => (node.id ? node.tagName.toLowerCase() + '#' + node.id : node.tagName.toLowerCase() + (node.classList.length > 0 ? '.' + node.classList[0] : ''));`;
