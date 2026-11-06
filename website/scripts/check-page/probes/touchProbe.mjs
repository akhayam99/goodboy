import { MIN_TOUCH_FONT_PX, MIN_TOUCH_TARGET_PX } from '../constants.mjs';
import { SHOWN_HELPER } from './shownHelper.mjs';

export const TOUCH_PROBE = `(async () => {
  ${SHOWN_HELPER}
  const nextFrame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const toggle = document.querySelector('.navMenuButton');
  const hasMenu = toggle !== null && isShown(toggle);
  if (hasMenu) {
    toggle.click();
    await nextFrame();
  }
  const smallText = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
    const element = text.parentElement;
    if (element === null || text.textContent.trim() === '' || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName) || !isShown(element)) {
      continue;
    }
    const size = parseFloat(getComputedStyle(element).fontSize);
    if (size < ${MIN_TOUCH_FONT_PX}) {
      smallText.add(size + ' px in ' + describe(element) + ': "' + text.textContent.trim().slice(0, 32) + '"');
    }
  }
  const smallTargets = [...document.querySelectorAll('button, .btn, nav a, .navSheet a, .heroFeatures, .installFeatures, .textLink, .refLink, footer a')]
    .filter(isShown)
    .map((node) => ({ node, height: node.getBoundingClientRect().height }))
    .filter(({ height }) => height < ${MIN_TOUCH_TARGET_PX})
    .map(({ node, height }) => height.toFixed(1) + ' px tall: ' + describe(node) + ' "' + node.textContent.trim().slice(0, 24) + '"');
  if (hasMenu) {
    toggle.click();
    await nextFrame();
  }
  return { hasMenu, smallText: [...smallText], smallTargets };
})()`;
