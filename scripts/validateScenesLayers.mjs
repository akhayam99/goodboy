export const LAYER_WIDTH = 1100;
export const LAYER_MAX_TABS = 12;
export const LAYER_WHEEL_DELTA = 600;

export const LAYER_SCENES = [
  {
    scene: 'drawer-overlay-narrow',
    label: 'drawer over the page',
    layer: 'aside[data-drawer-mode="overlay"]',
    isModal: true,
    isWheelChecked: true,
  },
  {
    scene: 'notifications&view=center',
    label: 'notifications popover',
    layer: '[data-dropdown-portal] > :last-child',
    isModal: false,
    isWheelChecked: false,
  },
  {
    scene: 'command-palette',
    label: 'command palette',
    layer: '[role="dialog"]',
    isModal: true,
    isWheelChecked: true,
  },
  {
    scene: 'image-lightbox',
    label: 'image lightbox',
    layer: 'dialog[open]',
    isModal: true,
    isWheelChecked: true,
  },
];

export const layerProbe = ({ selector, mode }) => {
  const layer = document.querySelector(selector);
  if (!(layer instanceof HTMLElement)) {
    return null;
  }
  const scrollers = () =>
    [...document.querySelectorAll('*')]
      .map((element, index) => ({ element, index }))
      .filter(
        ({ element }) =>
          !layer.contains(element) &&
          element.scrollHeight > element.clientHeight + 1 &&
          /(auto|scroll)/.test(getComputedStyle(element).overflowY),
      )
      .map(({ element, index }) => ({ index, top: element.scrollTop }))
      .concat([{ index: -1, top: document.documentElement.scrollTop }]);
  if (mode === 'scroll') {
    return { scrollers: scrollers() };
  }
  const focusables = [
    ...layer.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => element.getBoundingClientRect().width > 0);
  if (mode === 'focus') {
    const active = document.activeElement;
    const isOnPage = active instanceof Element && active !== document.body;
    return {
      isInside: !isOnPage || layer.contains(active),
      tag: active instanceof Element ? active.tagName.toLowerCase() : 'none',
      name:
        active instanceof Element
          ? (active.getAttribute('aria-label') ?? active.textContent ?? '').trim().slice(0, 24)
          : '',
    };
  }
  if (!layer.contains(document.activeElement) && focusables[0] instanceof HTMLElement) {
    focusables[0].focus();
  }
  const rect = layer.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return {
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    isHit: hit instanceof Node && layer.contains(hit),
    hitTag: hit instanceof Element ? hit.tagName.toLowerCase() : 'none',
    focusables: focusables.length,
    backdrop: { x: 4, y: 4 },
    scrollers: scrollers(),
  };
};

export const layerScrollMoves = ({ before, after }) =>
  after.flatMap(({ index, top }) => {
    const earlier = before.find((scroller) => scroller.index === index);
    return earlier === undefined || earlier.top === top
      ? []
      : [{ index, from: earlier.top, to: top }];
  });

export const layerFailures = ({ entry, measured }) => {
  const { scene, label, isModal, isWheelChecked } = entry;
  if (measured.layer === null) {
    return [{ scene, check: `the ${label} is on screen` }];
  }
  const failures = [];
  if (!measured.layer.isHit) {
    failures.push({
      scene,
      check: `the ${label} is the topmost thing at its centre`,
      hit: measured.layer.hitTag,
    });
  }
  if (isModal && measured.layer.focusables === 0) {
    failures.push({ scene, check: `the ${label} holds something to focus` });
  }
  const escaped = measured.tabs.findIndex((tab) => !tab.isInside);
  if (isModal && escaped !== -1) {
    failures.push({
      scene,
      check: `Tab stays inside the ${label}`,
      press: escaped + 1,
      landedOn: measured.tabs[escaped].tag,
    });
  }
  if (isWheelChecked && measured.moves.length > 0) {
    failures.push({
      scene,
      check: `a wheel on the ${label} backdrop scrolls nothing behind it`,
      moved: measured.moves,
    });
  }
  return failures;
};
