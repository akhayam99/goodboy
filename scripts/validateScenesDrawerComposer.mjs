export const DRAWER_COMPOSER_SCENES = [
  'u26-p21-drawer-composer-light',
  'u26-p21-drawer-composer-dark',
];
export const DRAWER_COMPOSER_WIDTHS = [1440];
export const DRAWER_COMPOSER_READY = '[data-composer-toolbar]';
export const DRAWER_COMPOSER_TOLERANCE_PX = 1;

export const drawerComposerProbe = () => {
  const toolbars = [...document.querySelectorAll('[data-composer-toolbar]')];
  const toolbar = toolbars.at(-1) ?? null;
  const drawer = toolbar?.closest('[data-container="drawer"]') ?? null;
  if (toolbar === null || drawer === null) {
    return null;
  }
  const box = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
    };
  };
  const row = toolbar.firstElementChild ?? toolbar;
  const controls = [...toolbar.querySelectorAll('button')]
    .filter((button) => button.getBoundingClientRect().width > 0)
    .map(box);
  return { toolbar: box(row), drawer: box(drawer), controls };
};

const round = (value) => Math.round(value * 10) / 10;

export const drawerComposerFailures = ({
  scene,
  width,
  measured,
  tolerance = DRAWER_COMPOSER_TOLERANCE_PX,
}) => {
  if (measured === null) {
    return [{ scene, width, check: 'the drawer shows a composer toolbar' }];
  }
  const failures = [];
  const { toolbar, drawer, controls } = measured;
  for (const control of controls) {
    if (control.right > toolbar.right + tolerance || control.left < toolbar.left - tolerance) {
      failures.push({
        scene,
        width,
        check: 'every toolbar control stays inside the toolbar',
        control: control.name,
        right: round(control.right),
        edge: round(toolbar.right),
      });
    }
    if (control.right > drawer.right + tolerance) {
      failures.push({
        scene,
        width,
        check: 'no toolbar control runs past the drawer edge',
        control: control.name,
      });
    }
  }
  for (const [index, first] of controls.entries()) {
    for (const second of controls.slice(index + 1)) {
      const overlapX = Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      if (overlapX > tolerance && overlapY > tolerance) {
        failures.push({
          scene,
          width,
          check: 'no two toolbar controls overlap',
          first: first.name,
          second: second.name,
        });
      }
    }
  }
  const tops = controls.map((control) => control.top);
  if (tops.length > 0 && Math.max(...tops) - Math.min(...tops) > toolbar.height) {
    failures.push({ scene, width, check: 'the toolbar controls sit on one row' });
  }
  const actions = controls.filter((control) => /^(Queue|Send)/.test(control.name));
  const heights = actions.map((control) => control.height);
  if (heights.length > 1 && Math.max(...heights) - Math.min(...heights) > tolerance) {
    failures.push({
      scene,
      width,
      check: 'every toolbar button has the same height',
      heights: heights.map(round),
    });
  }
  return failures;
};
