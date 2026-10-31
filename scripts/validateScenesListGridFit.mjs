export const LIST_GRID_FIT_SCENES = ['u31-runs', 'c08-runs', 'u31-overview'];
export const LIST_GRID_FIT_WIDTHS = [1024, 1440];
export const LIST_GRID_FIT_READY = '[data-list-grid-row]';
export const LIST_GRID_FIT_TOLERANCE_PX = 0.5;

export const listGridFitProbe = () =>
  [...document.querySelectorAll('[data-list-grid]')].map((grid) => {
    const right = grid.getBoundingClientRect().right;
    const rows = [...grid.querySelectorAll('[data-list-grid-row]')].map((row) => {
      const leaves = [...row.querySelectorAll('*')].filter((leaf) => leaf.children.length === 0);
      const leafRight = leaves.reduce(
        (widest, leaf) => Math.max(widest, leaf.getBoundingClientRect().right),
        row.getBoundingClientRect().right,
      );
      const boxes = [row, ...row.querySelectorAll('[data-list-grid-cell]')];
      const overflow = boxes.reduce(
        (widest, box) => Math.max(widest, box.scrollWidth - box.clientWidth),
        0,
      );
      return {
        label: (row.textContent ?? '').trim().slice(0, 40),
        right: leafRight,
        overflow,
      };
    });
    return { label: grid.getAttribute('aria-label') ?? '', right, rows };
  });

const round = (value) => Math.round(value * 10) / 10;

export const listGridFitFailures = ({
  scene,
  width,
  grids,
  tolerance = LIST_GRID_FIT_TOLERANCE_PX,
}) => {
  if (grids.length === 0) {
    return [{ scene, width, check: 'no list grid to measure' }];
  }
  const failures = [];
  for (const grid of grids) {
    const over = grid.rows.filter((row) => row.right > grid.right + tolerance);
    if (over.length > 0) {
      failures.push({
        scene,
        width,
        check: `a row of the ${grid.label} list runs past its right edge`,
        edge: round(grid.right),
        rows: over.map((row) => ({ row: row.label, right: round(row.right) })),
      });
    }
    const wide = grid.rows.filter((row) => (row.overflow ?? 0) > tolerance);
    if (wide.length > 0) {
      failures.push({
        scene,
        width,
        check: `a row or cell of the ${grid.label} list holds content wider than itself`,
        rows: wide.map((row) => ({ row: row.label, overflow: round(row.overflow) })),
      });
    }
  }
  return failures;
};

export const runListGridFit = async ({ send, only, measure, open, run }) => {
  for (const scene of only === undefined || only === 'list-grid-fit' ? LIST_GRID_FIT_SCENES : []) {
    await measure({
      scene,
      task: async () => {
        const failures = [];
        for (const width of LIST_GRID_FIT_WIDTHS) {
          await open({ send, scene, width, zoom: 1, readySelector: LIST_GRID_FIT_READY });
          const grids = await run(send, listGridFitProbe, null);
          failures.push(...listGridFitFailures({ scene, width, grids }));
        }
        console.log(
          `${scene}: ${LIST_GRID_FIT_WIDTHS.length} widths, ${failures.length} list overflows`,
        );
        return { failures, wraps: 0 };
      },
    });
  }
};
