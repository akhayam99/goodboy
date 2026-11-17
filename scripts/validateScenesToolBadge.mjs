export const TOOL_BADGE_SCENES = ['session-tools-counts'];
export const TOOL_BADGE_WIDTHS = [1024, 1440];
export const TOOL_BADGE_READY = '[data-testid="tool-count"]';
export const TOOL_BADGE_TOLERANCE_PX = 0.5;

export const toolBadgeProbe = () => {
  const rail = document.querySelector('[data-testid="session-tools"]');
  if (rail === null) {
    return null;
  }
  const box = (element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  };
  const tools = Array.from(rail.querySelectorAll('[data-slot="session-tool"]')).map((tool) => {
    const badge = tool.querySelector('[data-testid="tool-count"]');
    const caption = tool.querySelector('[data-slot="tool-caption"]');
    const glyph = tool.querySelector('[data-slot="tool-glyph"]');
    return {
      name: caption?.textContent ?? '',
      badge: badge === null ? null : box(badge),
      caption: caption === null ? null : box(caption),
      glyph: glyph === null ? null : box(glyph),
    };
  });
  return { rail: box(rail), tools };
};

const round = (value) => Math.round(value * 10) / 10;

export const toolBadgeFailures = ({
  scene,
  width,
  measured,
  tolerance = TOOL_BADGE_TOLERANCE_PX,
}) => {
  if (measured === null) {
    return [{ scene, width, check: 'the scene shows the Tools rail' }];
  }
  const withBadge = measured.tools.filter((tool) => tool.badge !== null);
  if (withBadge.length === 0) {
    return [{ scene, width, check: 'the Tools rail shows a count badge' }];
  }
  return withBadge.flatMap((tool) => {
    const failures = [];
    if (tool.caption !== null && tool.badge.bottom > tool.caption.top + tolerance) {
      failures.push({
        scene,
        width,
        tool: tool.name,
        check: 'the count badge never covers the tool label',
        badge: round(tool.badge.bottom),
        caption: round(tool.caption.top),
      });
    }
    if (tool.badge.right > measured.rail.right + tolerance) {
      failures.push({
        scene,
        width,
        tool: tool.name,
        check: 'the count badge stays inside the rail',
        badge: round(tool.badge.right),
        rail: round(measured.rail.right),
      });
    }
    if (
      tool.glyph !== null &&
      (tool.badge.left < (tool.glyph.left + tool.glyph.right) / 2 ||
        tool.badge.bottom > (tool.glyph.top + tool.glyph.bottom) / 2)
    ) {
      failures.push({
        scene,
        width,
        tool: tool.name,
        check: 'the count badge sits on the top end corner of the glyph',
      });
    }
    return failures;
  });
};

export const runToolBadge = async ({ send, only, measure, open, run }) => {
  for (const scene of only === undefined || only === 'tool-badge' ? TOOL_BADGE_SCENES : []) {
    await measure({
      scene,
      task: async () => {
        const failures = [];
        for (const width of TOOL_BADGE_WIDTHS) {
          await open({ send, scene, width, zoom: 1, readySelector: TOOL_BADGE_READY });
          const measured = await run(send, toolBadgeProbe, null);
          failures.push(...toolBadgeFailures({ scene, width, measured }));
        }
        console.log(
          `${scene}: ${TOOL_BADGE_WIDTHS.length} widths, ${failures.length} badge misses`,
        );
        return { failures, wraps: 0 };
      },
    });
  }
};
