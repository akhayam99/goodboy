export const TOOL_SIGNAL_SCENES = ['session-tools-signal'];
export const TOOL_SIGNAL_WIDTHS = [1024, 1440];
export const TOOL_SIGNAL_READY = '[data-testid="tool-signal"]';
export const TOOL_SIGNAL_TOLERANCE_PX = 0.5;

export const toolSignalProbe = () => {
  const rail = document.querySelector('[data-testid="session-tools"]');
  if (rail === null) {
    return null;
  }
  const box = (element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  };
  const tools = Array.from(rail.querySelectorAll('[data-slot="session-tool"]')).map((tool) => {
    const signal = tool.querySelector('[data-testid="tool-signal"]');
    const caption = tool.querySelector('[data-slot="tool-caption"]');
    const glyph = tool.querySelector('[data-slot="tool-glyph"]');
    return {
      name: caption?.textContent ?? '',
      signal: signal === null ? null : box(signal),
      caption: caption === null ? null : box(caption),
      glyph: glyph === null ? null : box(glyph),
      glyphText: glyph?.textContent ?? '',
    };
  });
  return { rail: box(rail), tools };
};

const round = (value) => Math.round(value * 10) / 10;

export const toolSignalFailures = ({
  scene,
  width,
  measured,
  tolerance = TOOL_SIGNAL_TOLERANCE_PX,
}) => {
  if (measured === null) {
    return [{ scene, width, check: 'the scene shows the Tools rail' }];
  }
  const numbers = measured.tools
    .filter((tool) => tool.glyphText !== '')
    .map((tool) => ({ scene, width, tool: tool.name, check: 'the Tools rail draws no number' }));
  const withSignal = measured.tools.filter((tool) => tool.signal !== null);
  if (withSignal.length === 0) {
    return [...numbers, { scene, width, check: 'the Tools rail shows a signal dot' }];
  }
  return [
    ...numbers,
    ...withSignal.flatMap((tool) => {
      const failures = [];
      if (tool.caption !== null && tool.signal.bottom > tool.caption.top + tolerance) {
        failures.push({
          scene,
          width,
          tool: tool.name,
          check: 'the signal dot never covers the tool label',
          signal: round(tool.signal.bottom),
          caption: round(tool.caption.top),
        });
      }
      if (tool.signal.right > measured.rail.right + tolerance) {
        failures.push({
          scene,
          width,
          tool: tool.name,
          check: 'the signal dot stays inside the rail',
          signal: round(tool.signal.right),
          rail: round(measured.rail.right),
        });
      }
      if (
        tool.glyph !== null &&
        (tool.signal.left < (tool.glyph.left + tool.glyph.right) / 2 ||
          tool.signal.bottom > (tool.glyph.top + tool.glyph.bottom) / 2)
      ) {
        failures.push({
          scene,
          width,
          tool: tool.name,
          check: 'the signal dot sits on the top end corner of the glyph',
        });
      }
      return failures;
    }),
  ];
};

export const runToolSignal = async ({ send, only, measure, open, run }) => {
  for (const scene of only === undefined || only === 'tool-signal' ? TOOL_SIGNAL_SCENES : []) {
    await measure({
      scene,
      task: async () => {
        const failures = [];
        for (const width of TOOL_SIGNAL_WIDTHS) {
          await open({ send, scene, width, zoom: 1, readySelector: TOOL_SIGNAL_READY });
          const measured = await run(send, toolSignalProbe, null);
          failures.push(...toolSignalFailures({ scene, width, measured }));
        }
        console.log(
          `${scene}: ${TOOL_SIGNAL_WIDTHS.length} widths, ${failures.length} signal misses`,
        );
        return { failures, wraps: 0 };
      },
    });
  }
};
