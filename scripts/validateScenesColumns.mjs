export const COLUMN_NAMES = ['model', 'stack', 'action'];
export const COLUMN_TOLERANCE_PX = 1;
export const COLUMN_WIDTHS = [1100, 1440, 1920];
export const COLUMN_SCENES = ['step-rows-activity', 'step-rows-runs', 'workflow-run-plan-review'];

export const COLUMN_ROW_SELECTOR = '[data-row-id], [data-testid^="run-tree-row-"]';

export const columnEdgesProbe = ({ names, selector }) =>
  [...document.querySelectorAll(selector)].map((row) => {
    const edges = {};
    for (const name of names) {
      const column = row.querySelector(`[data-meta-column="${name}"]`);
      edges[name] = column === null ? null : column.getBoundingClientRect().right;
    }
    return { row: row.dataset.rowId ?? row.dataset.testid, edges };
  });

export const columnDriftFailures = ({ scene, width, rows, tolerance = COLUMN_TOLERANCE_PX }) => {
  const failures = [];
  if (rows.length === 0) {
    return [{ scene, width, check: 'no rows to measure the columns on' }];
  }
  for (const name of COLUMN_NAMES) {
    const measured = rows.filter((row) => row.edges[name] !== null);
    if (measured.length === 0) {
      continue;
    }
    const rights = measured.map((row) => row.edges[name]);
    const spread = Math.max(...rights) - Math.min(...rights);
    if (spread > tolerance) {
      failures.push({
        scene,
        width,
        check: `${name} column right edge drifts across rows`,
        spread: Math.round(spread * 10) / 10,
        rows: measured.map((row) => ({
          row: row.row,
          right: Math.round(row.edges[name] * 10) / 10,
        })),
      });
    }
  }
  return failures;
};
