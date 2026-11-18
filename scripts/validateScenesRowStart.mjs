export const ROW_START_SCENES = [
  'c13-terminal',
  'c13-terminal-workspace',
  'browser-page',
  'browser-pane',
  'browser-pane-rail',
  'terminal-drawer-session',
  'c03-panes-terminal',
  'c03-panes-scripts',
  'c05-overview-running',
  'branch-files',
  'changes-files-all',
  'changes-3-files',
  'changes-3-files-dark',
  'changes-300-files',
  'changes-300-files-dark',
  'branch-comments',
  'branch-checks',
  'branch-commits',
  'branch-pr-github',
  'artifacts-rows',
  'c08-runs',
  'r4-questions',
  'c06-agent-transcript',
  'c03-panes-context',
  'c06-agents-list',
  'c03-panes-ask',
  'work-lead-plan',
  'work-lead-working',
  'work-lead-push',
  'work-lead-dependency',
  'settings-app',
  'settings-providers',
  'settings-projects-rows',
  'workflow-run',
  'c12-tasks-all',
  'tasks-rail',
  'board-shell',
  'u37-composer-new-session-dark',
  'u37-composer-new-session-light',
  'chat-room',
  'impact',
  'frame-studio-workflows',
  'session-head-overview',
  'session-head-overview-light',
  'session-head-runs',
  'session-head-artifacts',
  'session-head-questions',
  'session-head-context',
  'session-head-branch',
  'session-head-branch-light',
  'run-page-plan',
  'run-page-plan-light',
  'run-page-working',
  'run-page-done',
  'run-page-done-light',
  'run-page-many',
  'run-page-lead-agent',
  'run-page-lead-next',
  'run-page-lead-next-light',
  'run-page-lead-working',
  'run-page-trace',
  'run-page-trace-light',
  'run-page-agent',
  'run-page-agent-light',
  'run-page-subagent',
];
export const ROW_START_WIDTHS = [1440];
export const ROW_START_READY = '[data-studio-rail], [data-page-header], [data-page-column]';
export const ROW_START_TOLERANCE_PX = 1;

export const rowStartProbe = async () => {
  const settleBy = performance.now() + 3000;
  while (performance.now() < settleBy) {
    const running = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === 'running' &&
          animation.effect?.getComputedTiming().iterations !== Infinity,
      );
    if (running.length === 0) {
      break;
    }
    await Promise.race([
      Promise.allSettled(running.map((animation) => animation.finished)),
      new Promise((resolvePromise) => setTimeout(resolvePromise, 200)),
    ]);
  }
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
  const readFrame = () => {
    const sidebar = document.querySelector('[data-side-column]');
    const main = document.querySelector('main [data-studio-host]');
    if (sidebar === null || main === null) {
      return null;
    }
    const side = controlsIn(sidebar)[0];
    const floor = main.getBoundingClientRect().top;
    const isOnScreen = (element) => {
      const box = element.getBoundingClientRect();
      if (
        box.top < floor ||
        box.bottom > window.innerHeight ||
        element.closest('[inert]') !== null
      ) {
        return false;
      }
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit !== null && (hit === element || element.contains(hit));
    };
    const page = controlsIn(main)
      .filter(isOnScreen)
      .sort((one, other) => one.getBoundingClientRect().top - other.getBoundingClientRect().top);
    const head = page[0];
    if (side === undefined || head === undefined) {
      return null;
    }
    const headBox = head.getBoundingClientRect();
    const line = page
      .map((element) => ({ label: labelOf(element), box: element.getBoundingClientRect() }))
      .filter(({ box }) => {
        const overlap = Math.min(headBox.bottom, box.bottom) - Math.max(headBox.top, box.top);
        return overlap >= Math.min(headBox.height, box.height) / 2;
      });
    const sideBox = side.getBoundingClientRect();
    return {
      sidebar: { label: labelOf(side), top: sideBox.top, bottom: sideBox.bottom },
      page: {
        label: line.map(({ label }) => label).join(', '),
        top: Math.min(...line.map(({ box }) => box.top)),
        bottom: Math.max(...line.map(({ box }) => box.bottom)),
      },
    };
  };
  const readEdges = () => {
    const titleRows = [...document.querySelectorAll('[data-slot="pane-title-row"]')].filter(
      (row) => isShown(row) && row.closest('[inert]') === null,
    );
    return [...document.querySelectorAll('[data-list-heading]')]
      .filter((heading) => isShown(heading) && heading.closest('[inert]') === null)
      .flatMap((heading) => {
        const box = heading.getBoundingClientRect();
        const head = titleRows
          .map((row) => row.getBoundingClientRect())
          .filter((row) => row.top < box.top && row.left <= box.right && row.right >= box.left)
          .sort((one, other) => other.top - one.top)[0];
        return head === undefined
          ? []
          : [{ label: labelOf(heading), left: box.left, head: head.left }];
      });
  };
  const readMarks = () => {
    const sidebar = document.querySelector('[data-side-column]');
    if (sidebar === null) {
      return [];
    }
    return [
      ...sidebar.querySelectorAll(
        '[data-door-slot="signal"], [data-row-state], [data-slot="draft-dot"]',
      ),
    ]
      .filter((slot) => isShown(slot) && slot.closest('[inert]') === null)
      .map((slot) => {
        const box = slot.getBoundingClientRect();
        const row = slot.closest('button')?.getBoundingClientRect() ?? box;
        return {
          label: labelOf(slot.closest('button') ?? slot),
          width: box.width,
          height: box.height,
          centerX: box.left + box.width / 2,
          centerY: box.top + box.height / 2,
          rowCenterY: row.top + row.height / 2,
        };
      });
  };
  const marks = readMarks();
  const edges = readEdges();
  const frame = readFrame();
  const splits = [...document.querySelectorAll('[data-studio-rail]')].map((split) => ({
    kind: 'split',
    columns: [...split.children]
      .filter((child) => isShown(child) && child.querySelector(CONTROLS) !== null)
      .map(read),
  }));
  if (splits.length > 0) {
    return { containers: splits, frame, edges, marks };
  }
  const page = document.querySelector('[data-page-column]') ?? document.querySelector('main');
  return {
    containers: page === null ? [] : [{ kind: 'page', columns: [read(page)] }],
    frame,
    edges,
    marks,
  };
};

const round = (value) => Math.round(value * 10) / 10;

const spread = (values) => Math.max(...values) - Math.min(...values);

const centerOf = ({ top, bottom }) => (top + bottom) / 2;

export const frameRowFailures = ({ scene, width, frame, tolerance = ROW_START_TOLERANCE_PX }) => {
  if (frame === null || frame === undefined) {
    return [];
  }
  const { sidebar, page } = frame;
  const isSameHeight =
    Math.abs(sidebar.bottom - sidebar.top - (page.bottom - page.top)) <= tolerance;
  const isCentered = Math.abs(centerOf(sidebar) - centerOf(page)) <= tolerance;
  const isTopped = !isSameHeight || Math.abs(sidebar.top - page.top) <= tolerance;
  if (isCentered && isTopped) {
    return [];
  }
  return [
    {
      scene,
      width,
      check: 'the sidebar first row and the page first row share one top and one center line',
      rows: [
        `${sidebar.label}: ${round(sidebar.top)} to ${round(sidebar.bottom)}`,
        `${page.label}: ${round(page.top)} to ${round(page.bottom)}`,
      ],
    },
  ];
};

export const listEdgeFailures = ({ scene, width, edges, tolerance = ROW_START_TOLERANCE_PX }) => {
  const off = (edges ?? []).filter(({ left, head }) => Math.abs(left - head) > tolerance);
  if (off.length === 0) {
    return [];
  }
  return [
    {
      scene,
      width,
      check: 'every list heading starts on the left edge of the title row above it',
      rows: off.map(({ label, left, head }) => `${label}: ${round(left)} vs ${round(head)}`),
    },
  ];
};

export const SIDEBAR_MARK_PX = 16;

export const sidebarMarkFailures = ({
  scene,
  width,
  marks,
  tolerance = ROW_START_TOLERANCE_PX,
}) => {
  const all = marks ?? [];
  if (all.length === 0) {
    return [];
  }
  const failures = [];
  const offBox = all.filter(
    (mark) =>
      Math.abs(mark.width - SIDEBAR_MARK_PX) > tolerance ||
      Math.abs(mark.height - SIDEBAR_MARK_PX) > tolerance,
  );
  if (offBox.length > 0) {
    failures.push({
      scene,
      width,
      check: `every sidebar trailing mark sits in one ${SIDEBAR_MARK_PX}px box`,
      rows: offBox.map(({ label, width: w, height }) => `${label}: ${round(w)} x ${round(height)}`),
    });
  }
  if (spread(all.map(({ centerX }) => centerX)) > tolerance) {
    failures.push({
      scene,
      width,
      check: 'every sidebar trailing mark shares one center x',
      rows: all.map(({ label, centerX }) => `${label}: ${round(centerX)}`),
    });
  }
  const offCenter = all.filter(
    ({ centerY, rowCenterY }) => Math.abs(centerY - rowCenterY) > tolerance,
  );
  if (offCenter.length > 0) {
    failures.push({
      scene,
      width,
      check: 'every sidebar trailing mark sits on the center line of its row',
      rows: offCenter.map(
        ({ label, centerY, rowCenterY }) => `${label}: ${round(centerY)} vs ${round(rowCenterY)}`,
      ),
    });
  }
  return failures;
};

export const rowStartFailures = ({
  scene,
  width,
  measured,
  tolerance = ROW_START_TOLERANCE_PX,
}) => {
  const containers = measured?.containers ?? [];
  const failures = [
    ...frameRowFailures({ scene, width, frame: measured?.frame, tolerance }),
    ...listEdgeFailures({ scene, width, edges: measured?.edges, tolerance }),
    ...sidebarMarkFailures({ scene, width, marks: measured?.marks, tolerance }),
  ];
  if (containers.length === 0) {
    return [...failures, { scene, width, check: 'a page with columns is on screen' }];
  }
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
        let headings = 0;
        let marks = 0;
        for (const width of ROW_START_WIDTHS) {
          await open({ send, scene, width, zoom: 1, readySelector: ROW_START_READY });
          const measured = await run(send, rowStartProbe, null);
          headings += measured?.edges?.length ?? 0;
          marks += measured?.marks?.length ?? 0;
          failures.push(...rowStartFailures({ scene, width, measured }));
        }
        console.log(
          `${scene}: first rows, ${headings} list headings and ${marks} sidebar marks compared, ${failures.length} misalignments`,
        );
        return { failures, wraps: 0 };
      },
    });
  }
};
