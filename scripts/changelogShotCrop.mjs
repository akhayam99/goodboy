export const SHOT_SELECTOR = process.env.GOODBOY_SHOT_SELECTOR ?? null;
export const SHOT_PAD = Number(process.env.GOODBOY_SHOT_PAD ?? 24);
export const SHOT_VIEW = (process.env.GOODBOY_SHOT_VIEW ?? '1100x1400')
  .split('x')
  .map((value) => Number(value));
export const SHOT_CLICK_TEXT = process.env.GOODBOY_SHOT_CLICK_TEXT ?? null;

const cropExpression = ({ selector, pad, clickText }) => `(() => {
  const all = [...document.querySelectorAll(${JSON.stringify(selector)})];
  const target = all.at(-1);
  if (target === undefined) {
    return null;
  }
  const clickText = ${JSON.stringify(clickText)};
  if (clickText !== null) {
    const button = [...target.querySelectorAll('button, [role="option"]')].find(
      (candidate) => (candidate.textContent ?? '').includes(clickText),
    );
    button?.click();
    document.activeElement?.blur?.();
  }
  for (let node = target; node !== null && node !== document.body; node = node.parentElement) {
    if (node !== target) {
      node.style.boxShadow = 'none';
      node.style.borderColor = 'transparent';
    }
    for (const sibling of node.parentElement?.children ?? []) {
      if (sibling !== node) {
        sibling.style.visibility = 'hidden';
      }
    }
  }
  target.scrollIntoView({ block: 'center', inline: 'nearest' });
  const rect = target.getBoundingClientRect();
  const x = Math.max(0, rect.left - ${pad});
  const y = Math.max(0, rect.top - ${pad});
  const right = Math.min(window.innerWidth, rect.right + ${pad});
  const bottom = Math.min(window.innerHeight, rect.bottom + ${pad});
  return JSON.stringify({ x, y, width: right - x, height: bottom - y });
})()`;

export const cropClipOf = async ({ send, selector, pad, clickText, sleep }) => {
  const first = await send({
    method: 'Runtime.evaluate',
    params: { expression: cropExpression({ selector, pad, clickText }), returnByValue: true },
  });
  if (clickText !== null) {
    await sleep({ ms: 600 });
  }
  const settled = await send({
    method: 'Runtime.evaluate',
    params: { expression: cropExpression({ selector, pad, clickText: null }), returnByValue: true },
  });
  const value = settled.result?.result?.value ?? first.result?.result?.value ?? null;
  if (value === null) {
    throw new Error(`no element matches ${selector}`);
  }
  return { ...JSON.parse(value), scale: 1 };
};
