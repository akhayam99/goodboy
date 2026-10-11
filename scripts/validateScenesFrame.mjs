export const FRAME_WIDTHS = [1100, 1440, 1920];
export const FRAME_TOLERANCE_PX = 1;
export const FRAME_STAGE_MIN_RATIO = 0.4;
export const FRAME_STAGE_MAX_RATIO = 0.52;
export const FRAME_RAIL_QUERY = '&rail=1';
export const FRAME_CTX_RAIL_QUERY = '&ctx=rail';

export const FRAME_SCENES = [
  { scene: 'overview-full', rail: FRAME_RAIL_QUERY },
  { scene: 'runs-list-empty', rail: FRAME_RAIL_QUERY },
  { scene: 'step-rows-runs', rail: FRAME_RAIL_QUERY },
  { scene: 'run-header-failed', rail: FRAME_RAIL_QUERY },
  { scene: 'agents-list-empty', rail: FRAME_RAIL_QUERY },
  { scene: 'agentlead', rail: FRAME_RAIL_QUERY },
  { scene: 'frame-questions', rail: null },
  { scene: 'tasks-rail', rail: null },
  { scene: 'drawer-split-tasks', rail: FRAME_RAIL_QUERY },
  { scene: 'notifications', rail: null },
  { scene: 'frame&view=workflows', rail: FRAME_CTX_RAIL_QUERY },
  { scene: 'frame&view=impact', rail: FRAME_CTX_RAIL_QUERY },
  { scene: 'frame&view=settings', rail: FRAME_CTX_RAIL_QUERY },
  { scene: 'scripts-empty', rail: FRAME_RAIL_QUERY },
  { scene: 'artifact-states', rail: FRAME_RAIL_QUERY },
  { scene: 'explore', rail: FRAME_RAIL_QUERY },
  { scene: 'explore-changes', rail: FRAME_RAIL_QUERY },
  { scene: 'storage-other-tools', rail: FRAME_RAIL_QUERY },
  { scene: 'board-shell', rail: FRAME_RAIL_QUERY },
  { scene: 'chat-room', rail: FRAME_RAIL_QUERY },
  { scene: 'chat-empty-stage', rail: FRAME_RAIL_QUERY },
  { scene: 'frame&view=guide', rail: FRAME_CTX_RAIL_QUERY },
  { scene: 'frame&view=changelog', rail: FRAME_CTX_RAIL_QUERY },
  { scene: 'drawer-split-plan', rail: FRAME_RAIL_QUERY },
];

export const frameSceneVariants = ({ entry }) => {
  const pinned = { sidebar: 'pinned', url: entry.scene };
  if (entry.rail === null) {
    return [pinned];
  }
  return [pinned, { sidebar: 'rail', url: `${entry.scene}${entry.rail}` }];
};

export const frameSceneBaseId = ({ scene }) => scene.split('&')[0];

export const missingFrameScenes = ({ ids, entries = FRAME_SCENES }) => {
  const known = new Set(ids);
  return entries
    .map((entry) => frameSceneBaseId({ scene: entry.scene }))
    .filter((id) => !known.has(id));
};

export const frameProbe = async () => {
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
  const box = (element) => {
    if (element === null || element === undefined) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  };
  const isScrollClipped = (element, sheet) => {
    for (
      let node = element.parentElement;
      node !== null && node !== sheet;
      node = node.parentElement
    ) {
      const overflow = getComputedStyle(node).overflowY;
      const isScroller = overflow === 'auto' || overflow === 'scroll';
      if (isScroller && node.scrollHeight > node.clientHeight) {
        return true;
      }
    }
    return false;
  };
  const drawerElement = document.querySelector('[data-container="drawer"]');
  const sheetElement = document.querySelector('[data-container="page"]');
  const isOnTop = (element) => {
    const rect = element.getBoundingClientRect();
    const top = document.elementFromPoint(
      Math.min(rect.left + 4, window.innerWidth - 1),
      (rect.top + rect.bottom) / 2,
    );
    return top !== null && (element.contains(top) || top.contains(element));
  };
  const firstShown = (selector, scope) =>
    [...document.querySelectorAll(selector)].find(
      (element) =>
        element.closest('.invisible, [inert], [hidden], [aria-hidden="true"]') === null &&
        element.getBoundingClientRect().width > 0 &&
        (scope === null || scope.contains(element)) &&
        isOnTop(element),
    ) ?? null;
  const detailScope = document.querySelector('[data-studio-detail]') ?? sheetElement;
  const titleElement = firstShown('h1', detailScope);
  const trailScope =
    titleElement === null ? null : (titleElement.closest('[data-studio-detail]') ?? sheetElement);
  const trailElement = firstShown('[data-slot="trail"]', trailScope);
  const crumbElement =
    trailElement === null ? null : trailElement.querySelector('[data-trail-segment]');
  const bodyElement = document.querySelector('[data-slot="pane-body"]');
  const railElement = document.querySelector('aside[style*="grid-area: left"]');
  const drawerRowElement = document.querySelector('[data-drawer-header-row]');
  const composerElement = document.querySelector(
    '[data-prompt-field="message"], [data-slot="conversation-composer"]',
  );
  const stageElement = document.querySelector('[data-chat-stage]');
  const detailElement =
    document.querySelector('[data-studio-detail]') ?? sheetElement ?? document.body;
  const sheet = box(sheetElement);
  const slots = [...document.querySelectorAll('[data-slot]')]
    .filter((element) => sheetElement !== null && sheetElement.contains(element))
    .filter((element) => element.closest('[data-dropdown-portal]') === null)
    .map((element) => ({
      name: element.dataset.slot,
      isClipped: isScrollClipped(element, sheetElement),
      ...box(element),
    }))
    .filter((slot) => slot.right - slot.left > 0 && slot.bottom - slot.top > 0);
  const bodyColumn =
    bodyElement === null
      ? null
      : ([...bodyElement.querySelectorAll('[data-page-column]')].find(
          (column) => column.getBoundingClientRect().width > 0,
        ) ?? null);
  const bodyChild = bodyColumn === null ? null : box(bodyColumn);
  if (bodyChild !== null) {
    bodyChild.left += parseFloat(getComputedStyle(bodyColumn).paddingLeft);
  }
  return {
    hasSheet: sheetElement !== null,
    sheet,
    crumb: box(crumbElement),
    title: box(titleElement),
    bodyChild,
    trail: box(trailElement),
    rail: box(railElement),
    drawer: box(drawerElement),
    drawerRow: box(drawerRowElement),
    isDrawerInsidePage: [...document.querySelectorAll('[data-container="drawer"]')].some(
      (drawer) => {
        const page = drawer.closest('[data-container="page"]');
        return page !== null && !drawer.closest('aside')?.parentElement?.contains(page);
      },
    ),
    composer: box(composerElement),
    stage: box(stageElement),
    detail: box(detailElement),
    slots,
  };
};

const round = (value) => Math.round(value * 10) / 10;

const centreY = (rect) => (rect.top + rect.bottom) / 2;

const centreX = (rect) => (rect.left + rect.right) / 2;

const overlaps = ({ first, second }) =>
  first.left < second.right - FRAME_TOLERANCE_PX &&
  second.left < first.right - FRAME_TOLERANCE_PX &&
  first.top < second.bottom - FRAME_TOLERANCE_PX &&
  second.top < first.bottom - FRAME_TOLERANCE_PX;

export const frameFailures = ({
  scene,
  width,
  sidebar,
  measured,
  tolerance = FRAME_TOLERANCE_PX,
}) => {
  const failures = [];
  const fail = (rule, detail) => failures.push({ scene, width, sidebar, rule, ...detail });
  if (measured.crumb !== null && measured.title !== null) {
    const lefts = [measured.crumb.left, measured.title.left];
    if (measured.bodyChild !== null) {
      lefts.push(measured.bodyChild.left);
    }
    const spread = Math.max(...lefts) - Math.min(...lefts);
    if (spread > tolerance) {
      fail('rule 1', {
        check: 'crumb, h1 and first body child share one left edge',
        crumb: round(measured.crumb.left),
        title: round(measured.title.left),
        body: measured.bodyChild === null ? null : round(measured.bodyChild.left),
      });
    }
  }
  if (!measured.hasSheet) {
    fail('sheet', { check: 'no data-container="page" in the scene' });
    return failures;
  }
  const { sheet } = measured;
  const outside = measured.slots.filter((slot) => {
    const isOutsideX = slot.left < sheet.left - tolerance || slot.right > sheet.right + tolerance;
    const isOutsideY =
      !slot.isClipped &&
      (slot.top < sheet.top - tolerance || slot.bottom > sheet.bottom + tolerance);
    return isOutsideX || isOutsideY;
  });
  if (outside.length > 0) {
    fail('slots inside the sheet', {
      check: 'every data-slot lies inside the sheet',
      slots: outside.slice(0, 5).map((slot) => ({
        name: slot.name,
        left: round(slot.left),
        right: round(slot.right),
        top: round(slot.top),
        bottom: round(slot.bottom),
      })),
    });
  }
  if (measured.rail !== null && measured.trail !== null) {
    if (overlaps({ first: measured.rail, second: measured.trail })) {
      fail('rail over crumb', {
        check: 'no rail rect overlaps the crumb band',
        rail: round(measured.rail.right),
        crumb: round(measured.trail.left),
      });
    }
  }
  if (measured.drawerRow !== null && measured.trail !== null) {
    const drift = Math.abs(centreY(measured.trail) - centreY(measured.drawerRow));
    if (drift > tolerance) {
      fail('crumb and drawer header', {
        check: 'crumb row centre equals the drawer header centre',
        drift: round(drift),
      });
    }
  }
  if (measured.composer !== null && measured.composer.bottom > sheet.bottom + tolerance) {
    fail('composer', {
      check: 'composer bottom lies inside the sheet',
      over: round(measured.composer.bottom - sheet.bottom),
    });
  }
  if (measured.isDrawerInsidePage) {
    fail('drawer container', { check: 'the drawer container is a sibling of the page container' });
  }
  if (measured.stage !== null && measured.detail !== null) {
    const driftX = Math.abs(centreX(measured.stage) - centreX(measured.detail));
    const height = measured.detail.bottom - measured.detail.top;
    const ratio = (centreY(measured.stage) - measured.detail.top) / height;
    const isRatioOff = ratio < FRAME_STAGE_MIN_RATIO || ratio > FRAME_STAGE_MAX_RATIO;
    if (driftX > tolerance || isRatioOff) {
      fail('chat empty stage', {
        check: 'stage centre sits on the detail centre in x and at 40 to 52 percent in y',
        driftX: round(driftX),
        ratio: round(ratio * 100) / 100,
      });
    }
  }
  return failures;
};
