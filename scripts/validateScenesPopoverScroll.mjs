export const POPOVER_SCROLL_SCENE = 'popover-long-menu';
export const POPOVER_SCROLL_WIDTH = 1024;
export const POPOVER_SCROLL_HEIGHT = 400;
export const POPOVER_SCROLL_READY = '[data-dropdown-portal] [role="menuitem"]';
export const POPOVER_SCROLL_ROWS = 30;
export const POPOVER_SCROLL_TOLERANCE_PX = 1;

export const popoverScrollProbe = async () => {
  const nextFrame = () => new Promise((resolvePromise) => requestAnimationFrame(resolvePromise));
  const surface = document.querySelector('[data-dropdown-portal] > div');
  if (surface === null) {
    return null;
  }
  const items = [...surface.querySelectorAll('[role="menuitem"]')];
  const scrollers = [surface, ...surface.querySelectorAll('*')].filter((node) =>
    ['auto', 'scroll'].includes(getComputedStyle(node).overflowY),
  );
  const scroller = scrollers[0] ?? null;
  const last = items.at(-1) ?? null;
  const box = surface.getBoundingClientRect();
  const measured = {
    rows: items.length,
    scrollers: scrollers.length,
    windowHeight: window.innerHeight,
    surface: { top: box.top, bottom: box.bottom },
    scrollHeight: scroller?.scrollHeight ?? 0,
    clientHeight: scroller?.clientHeight ?? 0,
    fadeBottomAtTop: scroller?.style.getPropertyValue('--fade-bottom') ?? '',
  };
  if (scroller === null || last === null) {
    return { ...measured, scrollTop: 0, last: null, view: null, fadeTopAtEnd: '' };
  }
  last.scrollIntoView({ block: 'nearest' });
  await nextFrame();
  await nextFrame();
  const view = scroller.getBoundingClientRect();
  const row = last.getBoundingClientRect();
  return {
    ...measured,
    scrollTop: scroller.scrollTop,
    last: { top: row.top, bottom: row.bottom },
    view: { top: view.top, bottom: view.bottom },
    fadeTopAtEnd: scroller.style.getPropertyValue('--fade-top'),
  };
};

const round = (value) => Math.round(value * 10) / 10;

export const popoverScrollFailures = ({
  scene,
  width,
  measured,
  tolerance = POPOVER_SCROLL_TOLERANCE_PX,
}) => {
  if (measured === null) {
    return [{ scene, width, check: 'the scene opens a menu in a popover' }];
  }
  const failures = [];
  if (measured.rows !== POPOVER_SCROLL_ROWS) {
    failures.push({ scene, width, check: 'the menu draws all 30 rows', rows: measured.rows });
  }
  if (measured.scrollers !== 1) {
    failures.push({
      scene,
      width,
      check: 'the popover has exactly one scroller',
      scrollers: measured.scrollers,
    });
  }
  if (
    measured.surface.top < -tolerance ||
    measured.surface.bottom > measured.windowHeight + tolerance
  ) {
    failures.push({
      scene,
      width,
      check: 'the popover fits inside the 400px window',
      top: round(measured.surface.top),
      bottom: round(measured.surface.bottom),
    });
  }
  if (measured.scrollHeight <= measured.clientHeight + tolerance) {
    failures.push({
      scene,
      width,
      check: 'the rows overflow the popover and scroll',
      scrollHeight: measured.scrollHeight,
      clientHeight: measured.clientHeight,
    });
  }
  if (measured.fadeBottomAtTop === '' || measured.fadeBottomAtTop === '0px') {
    failures.push({ scene, width, check: 'the bottom edge fades before the menu scrolls' });
  }
  if (measured.last === null || measured.view === null) {
    failures.push({ scene, width, check: 'the last row exists in the scroller' });
    return failures;
  }
  if (measured.scrollTop <= 0) {
    failures.push({ scene, width, check: 'reaching the last row scrolls the popover' });
  }
  if (
    measured.last.top < measured.view.top - tolerance ||
    measured.last.bottom > measured.view.bottom + tolerance
  ) {
    failures.push({
      scene,
      width,
      check: 'the last row scrolls fully into view',
      rowBottom: round(measured.last.bottom),
      viewBottom: round(measured.view.bottom),
    });
  }
  if (measured.fadeTopAtEnd === '' || measured.fadeTopAtEnd === '0px') {
    failures.push({ scene, width, check: 'the top edge fades once the menu scrolled' });
  }
  return failures;
};

export const runPopoverScroll = async ({ send, only, measure, open, run }) => {
  if (only !== undefined && only !== 'popover-scroll') {
    return;
  }
  const scene = POPOVER_SCROLL_SCENE;
  await measure({
    scene,
    task: async () => {
      await open({
        send,
        scene,
        width: POPOVER_SCROLL_WIDTH,
        height: POPOVER_SCROLL_HEIGHT,
        zoom: 1,
        readySelector: POPOVER_SCROLL_READY,
      });
      const measured = await run(send, popoverScrollProbe, null);
      const failures = popoverScrollFailures({ scene, width: POPOVER_SCROLL_WIDTH, measured });
      console.log(
        `${scene}: ${failures.length} failures, rows ${measured?.rows}, scrollers ${measured?.scrollers}, content ${measured?.scrollHeight}/${measured?.clientHeight}, scrolled to ${measured?.scrollTop}`,
      );
      return { failures, wraps: 0 };
    },
  });
};
