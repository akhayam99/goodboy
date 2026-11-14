export const ROW_START_SCENES = [
  'c13-terminal',
  'c13-terminal-workspace',
  'browser-page',
  'browser-pane-rail',
  'c05-overview-running',
  'branch-files',
  'branch-comments',
  'branch-checks',
  'branch-commits',
  'branch-pr-github',
  'artifacts-rows',
  'c06-agent-transcript',
  'c03-panes-context',
  'c06-agents-list',
  'c03-panes-ask',
  'work-lead-plan',
  'work-lead-working',
  'settings-app',
  'settings-providers',
  'settings-projects-rows',
  'workflow-run',
  'c12-tasks-all',
  'tasks-rail',
];
export const ROW_START_WIDTHS = [1440];
export const ROW_START_READY = '[data-studio-rail], [data-page-header], [data-page-column]';
export const ROW_START_TOLERANCE_PX = 1;

export const rowStartProbe = () => {
  const CONTROLS =
    'button, a[href], input, select, textarea, [role="tab"], [role="button"], h1, h2, h3, h4';
  const isShown = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 2 && box.height > 2 && getComputedStyle(element).visibility !== 'hidden';
  };
  const labelOf = (element) =>
    (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 28);
  const controlsIn = (column) =>
    [...column.querySelectorAll(CONTROLS)].filter(
      (element) =>
        isShown(element) &&
        element.parentElement?.closest(CONTROLS) === null &&
        element.closest('.sr-only') === null,
    );
  const read = (column) => {
    const controls = controlsIn(column);
    const head = controls[0];
    const rows = {};
    for (const row of column.querySelectorAll('[data-grid-row]')) {
      const box = row.getBoundingClientRect();
      if (box.height > 0) {
        rows[row.getAttribute('data-grid-row')] = { top: box.top, bottom: box.bottom };
      }
    }
    if (head === undefined) {
      return { label: column.getAttribute('aria-label') ?? column.tagName, first: null, rows };
    }
    const box = head.getBoundingClientRect();
    const line = controls
      .map((element) => ({ label: labelOf(element), box: element.getBoundingClientRect() }))
      .filter(({ box: other }) => {
        const overlap = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top);
        return overlap >= Math.min(box.height, other.height) / 2;
      })
      .map(({ label, box: other }) => ({ label, center: (other.top + other.bottom) / 2 }));
    return {
      label: column.getAttribute('aria-label') ?? column.getAttribute('data-column') ?? '',
      first: { label: labelOf(head), top: box.top, bottom: box.bottom },
      line,
      rows,
    };
  };
  const splits = [...document.querySelectorAll('[data-studio-rail]')].map((split) => ({
    kind: 'split',
    columns: [...split.children]
      .filter((child) => isShown(child) && child.querySelector(CONTROLS) !== null)
      .map(read),
  }));
  if (splits.length > 0) {
    return { containers: splits };
  }
  const page = document.querySelector('[data-page-column]') ?? document.querySelector('main');
  return { containers: page === null ? [] : [{ kind: 'page', columns: [read(page)] }] };
};

const round = (value) => Math.round(value * 10) / 10;

const spread = (values) => Math.max(...values) - Math.min(...values);

export const rowStartFailures = ({
  scene,
  width,
  measured,
  tolerance = ROW_START_TOLERANCE_PX,
}) => {
  const containers = measured?.containers ?? [];
  if (containers.length === 0) {
    return [{ scene, width, check: 'a page with columns is on screen' }];
  }
  const failures = [];
  for (const container of containers) {
    const columns = container.columns.filter((column) => column.first !== null);
    const centers = columns.map(({ first }) => (first.top + first.bottom) / 2);
    if (columns.length > 1 && spread(centers) > tolerance) {
      failures.push({
        scene,
        width,
        check: 'the first row of each column shares a center line',
        rows: columns.map(({ first }, index) => `${first.label}: ${round(centers[index])}`),
      });
    }
    for (const column of columns) {
      const lineCenters = column.line.map(({ center }) => center);
      if (spread(lineCenters) > tolerance) {
        failures.push({
          scene,
          width,
          check: 'the controls of a toolbar row share a center line',
          controls: column.line.map(({ label, center }) => `${label}: ${round(center)}`),
        });
      }
    }
    const names = new Set(container.columns.flatMap((column) => Object.keys(column.rows)));
    for (const name of [...names].sort()) {
      const rows = container.columns.flatMap((column) =>
        column.rows[name] === undefined ? [] : [column.rows[name]],
      );
      if (
        rows.length > 1 &&
        (spread(rows.map(({ top }) => top)) > tolerance ||
          spread(rows.map(({ bottom }) => bottom)) > tolerance)
      ) {
        failures.push({
          scene,
          width,
          check: `grid row ${name} has the same top and bottom in every column`,
          rows: rows.map(({ top, bottom }) => `${round(top)} to ${round(bottom)}`),
        });
      }
    }
  }
  return failures;
};

const pickedScene = () => {
  const index = process.argv.indexOf('--scene');
  return index < 0 ? undefined : process.argv[index + 1];
};

export const runRowStart = async ({ send, only, measure, open, run }) => {
  const picked = pickedScene();
  const scenes = ROW_START_SCENES.filter((scene) => picked === undefined || scene === picked);
  for (const scene of only === undefined || only === 'row-start' ? scenes : []) {
    await measure({
      scene,
      task: async () => {
        const failures = [];
        for (const width of ROW_START_WIDTHS) {
          await open({ send, scene, width, zoom: 1, readySelector: ROW_START_READY });
          const measured = await run(send, rowStartProbe, null);
          failures.push(...rowStartFailures({ scene, width, measured }));
        }
        console.log(`${scene}: first rows compared, ${failures.length} misalignments`);
        return { failures, wraps: 0 };
      },
    });
  }
};
