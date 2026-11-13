export const TITLE_BAND_SCENES = ['board', 'c05-overview-running', 'c06-agent-transcript'];
export const TITLE_BAND_WIDTHS = [1100, 1440];
export const TITLE_BAND_READY = '[data-page-header]';
export const TITLE_BAND_HEIGHTS_PX = [40, 48, 64];
export const TITLE_BAND_TOLERANCE_PX = 0.5;

export const titleBandProbe = () => {
  const header = document.querySelector('[data-page-header]');
  const block = header?.querySelector('[data-slot="pane-title-block"]') ?? null;
  if (header === null || header === undefined || block === null) {
    return null;
  }
  const style = getComputedStyle(header);
  const pad = (side) => Number.parseFloat(style.getPropertyValue(`padding-${side}`)) || 0;
  return {
    top: pad('top'),
    block: block.getBoundingClientRect().height,
    bottom: pad('bottom'),
    isPinned: header.hasAttribute('data-pinned'),
  };
};

const round = (value) => Math.round(value * 10) / 10;

export const titleBandFailures = ({
  scene,
  width,
  measured,
  allowed = TITLE_BAND_HEIGHTS_PX,
  tolerance = TITLE_BAND_TOLERANCE_PX,
}) => {
  if (measured === null) {
    return [{ scene, width, check: 'the page header and its title row are on screen' }];
  }
  if (measured.isPinned) {
    return [];
  }
  const band = measured.top + measured.block + measured.bottom;
  if (allowed.some((height) => Math.abs(height - band) <= tolerance)) {
    return [];
  }
  return [
    {
      scene,
      width,
      check: `the title band is one of ${allowed.join(', ')} pixels`,
      band: round(band),
      top: round(measured.top),
      block: round(measured.block),
      bottom: round(measured.bottom),
    },
  ];
};

export const runTitleBand = async ({ send, only, measure, open, run }) => {
  for (const scene of only === undefined || only === 'title-band' ? TITLE_BAND_SCENES : []) {
    await measure({
      scene,
      task: async () => {
        const failures = [];
        for (const width of TITLE_BAND_WIDTHS) {
          await open({ send, scene, width, zoom: 1, readySelector: TITLE_BAND_READY });
          const measured = await run(send, titleBandProbe, null);
          failures.push(...titleBandFailures({ scene, width, measured }));
        }
        console.log(`${scene}: ${TITLE_BAND_WIDTHS.length} widths, ${failures.length} band drifts`);
        return { failures, wraps: 0 };
      },
    });
  }
};
