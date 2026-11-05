export const HEADINGS_PROBE = `JSON.stringify([...document.querySelectorAll('h1, h2, h3')].map((node, index) => {
  const box = node.getBoundingClientRect();
  return { index, tag: node.tagName.toLowerCase(), x: box.left, y: box.top + window.scrollY, width: box.width, height: box.height };
}).filter((box) => box.width > 0 && box.height > 0))`;
