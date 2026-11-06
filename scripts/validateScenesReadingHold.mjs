export const READING_HOLD_SCENES = ['u27-breadcrumbs-after-agent-light'];
export const READING_HOLD_WIDTH = 1100;
export const READING_HOLD_HEIGHT = 640;
export const READING_HOLD_READY = '[data-glance]';
export const READING_HOLD_TOLERANCE_PX = 1;

export const readingHoldProbe = async () => {
  const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
  const glance = document.querySelector('[data-glance]');
  const page = glance?.closest('.\\@container') ?? null;
  const scroller = page?.querySelector('.mask-fade-y') ?? null;
  const toggle =
    [...(page?.querySelectorAll('button') ?? [])].find(
      (button) => button.getAttribute('aria-label') === 'Run settings',
    ) ?? null;
  if (scroller === null || toggle === null) {
    return null;
  }
  const rows = [...scroller.querySelectorAll('ul > *')];
  scroller.scrollTop = 120;
  await wait(500);
  const top = () => scroller.getBoundingClientRect().top;
  const reading = rows.find((row) => row.getBoundingClientRect().top > top() + 20);
  if (reading === undefined || scroller.scrollTop === 0) {
    return { isReadable: false };
  }
  const place = () => reading.getBoundingClientRect().top;
  const start = place();
  toggle.click();
  await wait(600);
  const opened = place();
  toggle.click();
  await wait(600);
  const closed = place();
  return { isReadable: true, opened: opened - start, closed: closed - start };
};

export const readingHoldFailures = ({
  scene,
  width,
  measured,
  tolerance = READING_HOLD_TOLERANCE_PX,
}) => {
  if (measured === null || measured.isReadable === false) {
    return [
      { scene, width, check: 'the agent page has a transcript to read and a Settings toggle' },
    ];
  }
  const failures = [];
  if (Math.abs(measured.opened) > tolerance) {
    failures.push({
      scene,
      width,
      check: 'opening Settings does not move the text being read',
      moved: Math.round(measured.opened * 10) / 10,
    });
  }
  if (Math.abs(measured.closed) > tolerance) {
    failures.push({
      scene,
      width,
      check: 'closing Settings puts the text being read back',
      moved: Math.round(measured.closed * 10) / 10,
    });
  }
  return failures;
};

export const runReadingHold = async ({ send, only, measure, open, run }) => {
  for (const scene of only === undefined || only === 'reading-hold' ? READING_HOLD_SCENES : []) {
    await measure({
      scene,
      task: async () => {
        await open({
          send,
          scene,
          width: READING_HOLD_WIDTH,
          height: READING_HOLD_HEIGHT,
          zoom: 1,
          readySelector: READING_HOLD_READY,
        });
        const measured = await run(send, readingHoldProbe, null);
        const failures = readingHoldFailures({ scene, width: READING_HOLD_WIDTH, measured });
        console.log(`${scene}: ${failures.length} moved readings`);
        return { failures, wraps: 0 };
      },
    });
  }
};
