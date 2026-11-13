export const FROST_SCENES = ['branch-pr-github', 'c04-worktree-files'];
export const FROST_WIDTH = 1440;
export const FROST_HEIGHT = 900;
export const FROST_READY = '[data-page-scroller]';
export const FROST_WHEEL_STEPS = 6;
export const FROST_WHEEL_PX = 120;
export const FROST_SETTLE_MS = 600;

const pause = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

export const frostAimProbe = () => {
  const viewport = document.querySelector('[data-page-scroller]');
  if (viewport === null) {
    return null;
  }
  const box = viewport.getBoundingClientRect();
  return {
    x: Math.round(box.left + box.width / 2),
    y: Math.round(box.top + box.height / 2),
    range: viewport.scrollHeight - viewport.clientHeight,
  };
};

export const frostProbe = () => {
  const viewport = document.querySelector('[data-page-scroller]');
  const region = viewport?.closest('[data-slot="reveal-region"]') ?? null;
  const overlay = region?.querySelector('[data-slot="reveal-overlay"]') ?? null;
  if (viewport === null || region === null) {
    return null;
  }
  const inset = Number.parseFloat(region.style.getPropertyValue('--reveal-inset')) || 0;
  const pinned = overlay?.getBoundingClientRect() ?? null;
  const box = viewport.getBoundingClientRect();
  const probeY = pinned === null ? box.top : pinned.bottom - 2;
  const under = document
    .elementsFromPoint(box.left + box.width / 2, probeY)
    .filter((element) => element !== viewport && viewport.contains(element));
  return {
    inset,
    scrollTop: viewport.scrollTop,
    isHeaderHidden: region.getAttribute('data-reveal-header') === 'hidden',
    hasContentUnder: under.length > 0,
  };
};

export const frostFailures = ({ scene, width, measured }) => {
  if (measured === null) {
    return [{ scene, width, check: 'the page has a reader inside a reveal region' }];
  }
  if (measured.scrollTop <= 0) {
    return [{ scene, width, check: 'a real wheel scrolls the reader' }];
  }
  if (measured.inset <= 0 || measured.hasContentUnder) {
    return [];
  }
  return [
    {
      scene,
      width,
      check: 'the first content row meets the pinned row after a wheel',
      inset: measured.inset,
      scrollTop: measured.scrollTop,
    },
  ];
};

export const runFrost = async ({ send, only, measure, open, run }) => {
  for (const scene of only === undefined || only === 'frost' ? FROST_SCENES : []) {
    await measure({
      scene,
      task: async () => {
        await open({
          send,
          scene,
          width: FROST_WIDTH,
          height: FROST_HEIGHT,
          zoom: 1,
          readySelector: FROST_READY,
        });
        const aim = await run(send, frostAimProbe, null);
        if (aim !== null) {
          for (let step = 0; step < FROST_WHEEL_STEPS; step += 1) {
            await send('Input.dispatchMouseEvent', {
              type: 'mouseWheel',
              x: aim.x,
              y: aim.y,
              deltaX: 0,
              deltaY: FROST_WHEEL_PX,
            });
            await pause(40);
          }
          await pause(FROST_SETTLE_MS);
        }
        const measured = aim === null ? null : await run(send, frostProbe, null);
        const failures = frostFailures({ scene, width: FROST_WIDTH, measured });
        console.log(`${scene}: ${failures.length} hard cuts under the pinned row`);
        return { failures, wraps: 0 };
      },
    });
  }
};
