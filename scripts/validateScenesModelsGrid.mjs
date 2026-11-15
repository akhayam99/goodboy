export const MODELS_GRID_SCENES = ['settings-providers-scope'];
export const MODELS_GRID_WIDTHS = [960, 1280];
export const MODELS_GRID_READY = '[data-role-grid]';
export const MODELS_GRID_TOLERANCE_PX = 0.5;

export const modelsGridProbe = () => {
  const rows = [...document.querySelectorAll('[data-role-grid]')].map((row) => {
    const band = row.closest('[data-band]');
    const edge = band === null ? window.innerWidth : band.getBoundingClientRect().right;
    const leaves = [...row.querySelectorAll('*')].filter((leaf) => leaf.children.length === 0);
    const right = leaves.reduce(
      (widest, leaf) => Math.max(widest, leaf.getBoundingClientRect().right),
      row.getBoundingClientRect().right,
    );
    return {
      label: (row.textContent ?? '').trim().slice(0, 40),
      template: getComputedStyle(row).gridTemplateColumns,
      right,
      edge,
      overflow: row.scrollWidth - row.clientWidth,
    };
  });
  const page = document.scrollingElement ?? document.documentElement;
  return { rows, pageOverflow: page.scrollWidth - page.clientWidth };
};

const round = (value) => Math.round(value * 10) / 10;

export const modelsGridFailures = ({
  scene,
  width,
  rows,
  pageOverflow,
  tolerance = MODELS_GRID_TOLERANCE_PX,
}) => {
  if (rows.length === 0) {
    return [{ scene, width, check: 'no model rows to measure' }];
  }
  const failures = [];
  const templates = [...new Set(rows.map((row) => row.template))];
  if (templates.length > 1) {
    failures.push({
      scene,
      width,
      check: 'model rows sit on different column templates',
      templates,
    });
  }
  const over = rows.filter((row) => row.right > row.edge + tolerance || row.overflow > tolerance);
  if (over.length > 0) {
    failures.push({
      scene,
      width,
      check: 'a model row runs past its band',
      rows: over.map((row) => ({ row: row.label, right: round(row.right), edge: round(row.edge) })),
    });
  }
  if (pageOverflow > tolerance) {
    failures.push({
      scene,
      width,
      check: 'the page scrolls sideways',
      overflow: round(pageOverflow),
    });
  }
  return failures;
};

export const runModelsGrid = async ({ send, only, measure, open, run }) => {
  for (const scene of only === undefined || only === 'models-grid' ? MODELS_GRID_SCENES : []) {
    await measure({
      scene,
      task: async () => {
        const failures = [];
        for (const width of MODELS_GRID_WIDTHS) {
          await open({ send, scene, width, zoom: 1, readySelector: MODELS_GRID_READY });
          const probe = await run(send, modelsGridProbe, null);
          failures.push(...modelsGridFailures({ scene, width, ...probe }));
        }
        console.log(
          `${scene}: ${MODELS_GRID_WIDTHS.length} widths, ${failures.length} grid misses`,
        );
        return { failures, wraps: 0 };
      },
    });
  }
};
