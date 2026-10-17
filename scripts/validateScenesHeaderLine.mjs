export const HEADER_LINE_SCENES = ['r4-rail-tools-open'];
export const HEADER_LINE_WIDTHS = [1100, 1440, 1920];
export const HEADER_LINE_TOLERANCE_PX = 1;
export const HEADER_LINE_READY = '[data-drawer-header-row]';

export const headerLineProbe = () => {
  const box = (element) => {
    if (element === null || element === undefined) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    return { top: rect.top, centre: rect.top + rect.height / 2 };
  };
  const tool =
    document.querySelector('[data-drawer-edge] [data-testid="session-tools"] button') ??
    document.querySelector('[data-testid="session-tools"] button');
  return {
    rail: box(document.querySelector('[data-rail-top] [data-header-line]')),
    title: box(document.querySelector('[data-slot="pane-title-row"]')),
    tool: box(tool),
    drawer: box(document.querySelector('[data-drawer-header-row]')),
  };
};

const round = (value) => Math.round(value * 10) / 10;

export const headerLineFailures = ({
  scene,
  width,
  measured,
  tolerance = HEADER_LINE_TOLERANCE_PX,
}) => {
  const names = ['rail', 'title', 'tool', 'drawer'];
  const missing = names.filter((name) => measured[name] === null);
  if (missing.length > 0) {
    return [{ scene, width, check: 'every header row is on screen', missing }];
  }
  const failures = [];
  for (const key of ['top', 'centre']) {
    const values = names.map((name) => measured[name][key]);
    const spread = Math.max(...values) - Math.min(...values);
    if (spread > tolerance) {
      failures.push({
        scene,
        width,
        check: `rail top row, page title row, first tool and drawer header share one ${key}`,
        ...Object.fromEntries(names.map((name) => [name, round(measured[name][key])])),
      });
    }
  }
  return failures;
};
