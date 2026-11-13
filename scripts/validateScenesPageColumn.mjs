export const PAGE_COLUMN_SCENES = [
  { scene: 'c05-overview-running', kind: 'reading' },
  { scene: 'c12-tasks-all', kind: 'reading' },
  { scene: 'artifacts-rows', kind: 'reading' },
  { scene: 'workflow-run', kind: 'reading' },
  { scene: 'overview-full', kind: 'reading' },
  { scene: 'board', kind: 'full' },
];
export const PAGE_COLUMN_WIDTHS = [1440, 1920];
export const PAGE_COLUMN_READY = '[data-page-header]';
export const PAGE_COLUMN_FRAME_PX = 1008;
export const PAGE_COLUMN_GUTTER_PX = 24;
export const PAGE_COLUMN_TOLERANCE_PX = 1;

export const pageColumnProbe = () => {
  const header = document.querySelector('[data-page-header]');
  const column =
    header?.closest('[data-page-column]') ?? document.querySelector('[data-page-column]');
  const title = header?.querySelector('h1') ?? null;
  if (column === null || column === undefined || title === null) {
    return null;
  }
  const box = column.getBoundingClientRect();
  const style = getComputedStyle(column);
  const pane = column.parentElement?.getBoundingClientRect() ?? box;
  return {
    left: box.left,
    right: box.right,
    width: box.width,
    paneLeft: pane.left,
    paneRight: pane.right,
    gutter: Number.parseFloat(style.paddingLeft) || 0,
    title: title.getBoundingClientRect().left,
  };
};

const round = (value) => Math.round(value * 10) / 10;

export const pageColumnFailures = ({
  scene,
  width,
  kind,
  measured,
  tolerance = PAGE_COLUMN_TOLERANCE_PX,
}) => {
  if (measured === null) {
    return [{ scene, width, check: 'the page column and its title are on screen' }];
  }
  const failures = [];
  const gutterEdge = measured.left + measured.gutter;
  if (Math.abs(measured.title - gutterEdge) > tolerance) {
    failures.push({
      scene,
      width,
      check: "the title's left edge is the column's left edge",
      title: round(measured.title),
      column: round(gutterEdge),
    });
  }
  if (Math.abs(measured.gutter - PAGE_COLUMN_GUTTER_PX) > tolerance) {
    failures.push({
      scene,
      width,
      check: `the column gutter is ${PAGE_COLUMN_GUTTER_PX} pixels`,
      gutter: round(measured.gutter),
    });
  }
  if (kind === 'full') {
    const isFlush =
      Math.abs(measured.left - measured.paneLeft) <= tolerance &&
      Math.abs(measured.right - measured.paneRight) <= tolerance;
    return isFlush
      ? failures
      : [
          ...failures,
          {
            scene,
            width,
            check: 'a full-width page fills the pane',
            left: round(measured.left - measured.paneLeft),
            right: round(measured.paneRight - measured.right),
          },
        ];
  }
  if (measured.width > PAGE_COLUMN_FRAME_PX + tolerance) {
    failures.push({
      scene,
      width,
      check: `a reading column is at most ${PAGE_COLUMN_FRAME_PX} pixels`,
      columnWidth: round(measured.width),
    });
  }
  const before = measured.left - measured.paneLeft;
  const after = measured.paneRight - measured.right;
  if (Math.abs(before - after) > tolerance) {
    failures.push({
      scene,
      width,
      check: 'a reading column is centred in its pane',
      before: round(before),
      after: round(after),
    });
  }
  return failures;
};

export const runPageColumn = async ({ send, only, measure, open, run }) => {
  for (const { scene, kind } of only === undefined || only === 'page-column'
    ? PAGE_COLUMN_SCENES
    : []) {
    await measure({
      scene,
      task: async () => {
        const failures = [];
        for (const width of PAGE_COLUMN_WIDTHS) {
          await open({ send, scene, width, zoom: 1, readySelector: PAGE_COLUMN_READY });
          const measured = await run(send, pageColumnProbe, null);
          failures.push(...pageColumnFailures({ scene, width, kind, measured }));
        }
        console.log(
          `${scene}: ${PAGE_COLUMN_WIDTHS.length} widths, ${failures.length} column drifts`,
        );
        return { failures, wraps: 0 };
      },
    });
  }
};
