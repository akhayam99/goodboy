export const MENU_MIN_ROWS = 2;

export const menuRowsProbe = async ({
  openMs,
  closeMs,
  bootMs,
  perKind,
  maxTriggers,
  budgetMs,
}) => {
  const pausePage = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
  const startedAt = performance.now();
  const isDrawn = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && element.disabled !== true;
  };
  const labelOf = (element) =>
    (element.getAttribute('aria-label') ?? (element.textContent ?? '').trim()).trim();
  const kindOf = (element) =>
    `${element.className}|${labelOf(element).split(/\s+/).slice(0, 2).join(' ')}`;
  const currentMenus = () => [...document.querySelectorAll('[role="menu"]')];
  const hasExpandedTrigger = () =>
    document.querySelector('[aria-haspopup="menu"][aria-expanded="true"]') !== null;
  const pressEscape = () =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    );
  const rowsIn = (menus) =>
    new Set(
      menus.flatMap((menu) => [
        ...menu.querySelectorAll(
          '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]',
        ),
      ]),
    ).size;

  let lastSize = -1;
  let steadyPolls = 0;
  while (steadyPolls < 4 && performance.now() - startedAt < bootMs) {
    const size = document.getElementsByTagName('*').length;
    const isBooted = document.getElementById('boot-shell') === null;
    steadyPolls = isBooted && size === lastSize ? steadyPolls + 1 : 0;
    lastSize = size;
    await pausePage(50);
  }

  const isExpandedAtLoad = hasExpandedTrigger();
  const closeDeadline = performance.now() + closeMs;
  while (performance.now() < closeDeadline && hasExpandedTrigger()) {
    pressEscape();
    await pausePage(100);
  }
  if (isExpandedAtLoad) {
    await pausePage(closeMs / 4);
  }
  const persistent = new Set(currentMenus());
  const strayMenus = () => currentMenus().filter((menu) => !persistent.has(menu));

  const triggers = [...document.querySelectorAll('[aria-haspopup="menu"]')].filter(isDrawn);
  const kinds = new Map();
  for (const trigger of triggers) {
    const kind = kindOf(trigger);
    kinds.set(kind, [...(kinds.get(kind) ?? []), trigger]);
  }
  const sampled = [...kinds.values()]
    .flatMap((group) => {
      const picks = [0, Math.floor(group.length / 2), group.length - 1];
      return [...new Set(picks)].slice(0, perKind).map((index) => group[index]);
    })
    .slice(0, maxTriggers);

  const results = [];
  const runStartedAt = performance.now();
  let isOutOfTime = false;
  for (const trigger of sampled) {
    if (performance.now() - runStartedAt > budgetMs) {
      isOutOfTime = true;
      break;
    }
    if (!trigger.isConnected) continue;
    let opened = [];
    for (let attempt = 0; attempt < 2 && opened.length === 0; attempt += 1) {
      if (trigger.getAttribute('aria-expanded') !== 'true') {
        trigger.click();
      }
      const openDeadline = performance.now() + openMs;
      while (performance.now() < openDeadline) {
        opened = strayMenus();
        if (opened.length > 0) break;
        await pausePage(25);
      }
    }
    let rows = rowsIn(opened);
    let stablePolls = 0;
    const settleDeadline = performance.now() + openMs;
    while (opened.length > 0 && stablePolls < 2 && performance.now() < settleDeadline) {
      await pausePage(30);
      opened = strayMenus();
      const next = rowsIn(opened);
      stablePolls = next === rows ? stablePolls + 1 : 0;
      rows = next;
    }
    results.push({
      trigger: labelOf(trigger),
      kind: kindOf(trigger),
      isOpen: opened.length > 0,
      rows,
    });
    const settleCloseDeadline = performance.now() + closeMs;
    pressEscape();
    while (performance.now() < settleCloseDeadline && strayMenus().length > 0) {
      await pausePage(25);
    }
    if (strayMenus().length > 0) {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await pausePage(closeMs / 2);
    }
  }
  return { total: triggers.length, tested: results.length, isOutOfTime, results };
};

export const menuRowsFailures = ({ scene, probe }) => {
  const failures = [];
  const short = probe.results.filter((result) => result.rows < MENU_MIN_ROWS);
  if (short.length > 0) {
    failures.push({
      scene,
      check: 'a menu trigger opens to fewer than two rows',
      short: short.map(({ trigger, isOpen, rows }) => ({ trigger, isOpen, rows })),
    });
  }
  if (probe.isOutOfTime) {
    failures.push({
      scene,
      check: 'menu probe ran out of time',
      tested: probe.tested,
      total: probe.total,
    });
  }
  return failures;
};
