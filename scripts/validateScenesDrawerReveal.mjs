export const DRAWER_REVEAL_SCENES = ['u26-spawned-transcript-light', 'u26-spawned-auto-light'];
export const DRAWER_REVEAL_WIDTHS = [1440];
export const DRAWER_REVEAL_READY = '[data-drawer-card] [data-agent-id]';

export const drawerRevealProbe = () => {
  const card = document.querySelector('[data-drawer-card]');
  if (card === null) {
    return null;
  }
  const rows = [...card.querySelectorAll('[data-agent-id]')];
  const overflowing = document.createElement('div');
  overflowing.style.cssText = 'flex:none;width:4000px;height:4000px';
  card.prepend(overflowing);
  const scrolls = [];
  for (const block of ['center', 'nearest']) {
    for (const row of rows) {
      row.scrollIntoView({ block });
      scrolls.push({ block, top: card.scrollTop, left: card.scrollLeft });
    }
  }
  overflowing.remove();
  return { rows: rows.length, scrolls };
};

export const drawerRevealFailures = ({ scene, width, measured }) => {
  if (measured === null || measured.rows === 0) {
    return [{ scene, width, check: 'the drawer card holds spawned agent rows' }];
  }
  const moved = measured.scrolls.filter(({ top, left }) => top !== 0 || left !== 0);
  if (moved.length === 0) {
    return [];
  }
  return [
    {
      scene,
      width,
      check: 'a reveal inside the drawer never scrolls the drawer card',
      top: Math.max(...moved.map(({ top }) => top)),
      left: Math.max(...moved.map(({ left }) => left)),
    },
  ];
};

export const runDrawerReveal = async ({ send, only, measure, open, run }) => {
  for (const scene of only === undefined || only === 'drawer-reveal' ? DRAWER_REVEAL_SCENES : []) {
    await measure({
      scene,
      task: async () => {
        const failures = [];
        for (const width of DRAWER_REVEAL_WIDTHS) {
          await open({ send, scene, width, zoom: 1, readySelector: DRAWER_REVEAL_READY });
          const measured = await run(send, drawerRevealProbe, null);
          failures.push(...drawerRevealFailures({ scene, width, measured }));
        }
        console.log(
          `${scene}: ${DRAWER_REVEAL_WIDTHS.length} widths, ${failures.length} scrolled cards`,
        );
        return { failures, wraps: 0 };
      },
    });
  }
};
