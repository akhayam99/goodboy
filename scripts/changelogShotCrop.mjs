export const SHOT_SELECTOR = process.env.GOODBOY_SHOT_SELECTOR ?? null;
export const SHOT_PAD = Number(process.env.GOODBOY_SHOT_PAD ?? 24);
export const SHOT_VIEW = (process.env.GOODBOY_SHOT_VIEW ?? '1100x1400')
  .split('x')
  .map((value) => Number(value));
export const SHOT_CLICK_TEXT = process.env.GOODBOY_SHOT_CLICK_TEXT ?? null;
export const SHOT_PRE_CLICK_TEXT = process.env.GOODBOY_SHOT_PRE_CLICK_TEXT ?? null;
export const SHOT_HIDE = process.env.GOODBOY_SHOT_HIDE ?? null;
export const SHOT_REMOVE = process.env.GOODBOY_SHOT_REMOVE ?? null;
export const SHOT_FRAME_WIDTH =
  process.env.GOODBOY_SHOT_FRAME_WIDTH === undefined
    ? null
    : Number(process.env.GOODBOY_SHOT_FRAME_WIDTH);
export const SHOT_TOP_SELECTOR = process.env.GOODBOY_SHOT_TOP_SELECTOR ?? null;
export const SHOT_PAD_TOP = Number(
  process.env.GOODBOY_SHOT_PAD_TOP ?? process.env.GOODBOY_SHOT_PAD ?? 24,
);
export const SHOT_NOW = process.env.GOODBOY_SHOT_NOW ?? null;
export const SHOT_CLOCK_STOP_MS = Number(process.env.GOODBOY_SHOT_CLOCK_STOP_MS ?? Infinity);

const shotClock = ({ base, stopMs }) => {
  const RealDate = Date;
  const start = RealDate.now();
  const current = () => base + Math.min(RealDate.now() - start, stopMs);
  class ShotDate extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [current()] : args));
    }
    static now() {
      return current();
    }
  }
  globalThis.Date = ShotDate;
};

export const fixedClockScript = ({ now, stopMs }) =>
  `(${shotClock.toString()})({ base: ${Number(Date.parse(now))}, stopMs: ${Number(stopMs)} })`;

const setFrameWidth = ({ width }) => {
  document.querySelector('[data-shot]').style.width = `${width}px`;
};

const preClick = ({ text }) => {
  [...document.querySelectorAll('button')]
    .find((button) => (button.textContent ?? '').trim() === text)
    ?.click();
};

const cropInPage = ({ selector, pad, padTop, clickText, remove, hide, topSelector }) => {
  const target = [...document.querySelectorAll(selector)].at(-1);
  if (target === undefined) {
    return null;
  }
  if (clickText !== null) {
    const button = [...target.querySelectorAll('button, [role="option"]')].find((candidate) =>
      (candidate.textContent ?? '').includes(clickText),
    );
    button?.click();
    document.activeElement?.blur?.();
  }
  for (let node = target; node !== null && node !== document.body; node = node.parentElement) {
    if (node !== target) {
      node.style.boxShadow = 'none';
      node.style.borderColor = 'transparent';
      node.style.maskImage = 'none';
      node.style.webkitMaskImage = 'none';
    }
    for (const sibling of node.parentElement?.children ?? []) {
      if (sibling !== node) {
        sibling.style.visibility = 'hidden';
      }
    }
  }
  if (remove !== null) {
    for (const removed of document.querySelectorAll(remove)) {
      removed.style.display = 'none';
    }
  }
  if (hide !== null) {
    for (const hidden of document.querySelectorAll(hide)) {
      hidden.style.visibility = 'hidden';
    }
  }
  for (const inner of [target, ...target.querySelectorAll('*')]) {
    if (getComputedStyle(inner).maskImage !== 'none') {
      inner.style.maskImage = 'none';
      inner.style.webkitMaskImage = 'none';
    }
  }
  target.scrollIntoView({ block: 'center', inline: 'nearest' });
  const rect = target.getBoundingClientRect();
  const x = Math.max(0, rect.left - pad);
  const topElement =
    topSelector === null ? undefined : [...document.querySelectorAll(topSelector)].at(-1);
  const top =
    topElement === undefined
      ? rect.top
      : Math.max(rect.top, topElement.getBoundingClientRect().top);
  const y = Math.max(0, top - padTop);
  const right = Math.min(window.innerWidth, rect.right + pad);
  const bottom = Math.min(window.innerHeight, rect.bottom + pad);
  return { x, y, width: right - x, height: bottom - y };
};

const callInPage = async ({ send, fn, arg }) => {
  const global = await send({ method: 'Runtime.evaluate', params: { expression: 'globalThis' } });
  const result = await send({
    method: 'Runtime.callFunctionOn',
    params: {
      objectId: global.result?.result?.objectId,
      functionDeclaration: fn.toString(),
      arguments: [{ value: arg }],
      returnByValue: true,
    },
  });
  return result.result?.result?.value ?? null;
};

export const cropClipOf = async ({ send, selector, pad, clickText, sleep }) => {
  if (SHOT_FRAME_WIDTH !== null) {
    await callInPage({ send, fn: setFrameWidth, arg: { width: SHOT_FRAME_WIDTH } });
    await sleep({ ms: 600 });
  }
  if (SHOT_PRE_CLICK_TEXT !== null) {
    await callInPage({ send, fn: preClick, arg: { text: SHOT_PRE_CLICK_TEXT } });
    await sleep({ ms: 600 });
  }
  const options = {
    selector,
    pad,
    padTop: SHOT_PAD_TOP,
    clickText,
    remove: SHOT_REMOVE,
    hide: SHOT_HIDE,
    topSelector: SHOT_TOP_SELECTOR,
  };
  const first = await callInPage({ send, fn: cropInPage, arg: options });
  if (clickText !== null) {
    await sleep({ ms: 600 });
  }
  const settled = await callInPage({ send, fn: cropInPage, arg: { ...options, clickText: null } });
  const clip = settled ?? first;
  if (clip === null) {
    throw new Error(`no element matches ${selector}`);
  }
  return { ...clip, scale: 1 };
};
