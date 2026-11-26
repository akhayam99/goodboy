// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  countMatches,
  grownEntries,
  nonZero,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'panel-head.baseline.json';

const DOCK_PANELS: ReadonlyArray<string> = [
  'apps/desktop/src/features/terminal/components/TerminalDrawer/TerminalDrawerBody.tsx',
  'apps/desktop/src/features/browser/components/BrowserPane/index.tsx',
  'apps/desktop/src/features/scripts/components/ScriptsPanel/index.tsx',
  'apps/desktop/src/features/session/ask/components/AskPane/AskPaneBody.tsx',
  'apps/desktop/src/features/monitoring/components/MonitoringStudio/MonitoringDrawer.tsx',
];

const FRAME_OPENING = /<DrawerFrame\b/g;
const DOCK_FRAME = /<DrawerFrame\s+isDock\b/g;
const OWN_GRIP = /\buseDockGrip\(|data-dock-grip|\bGripVertical\b/g;

type TextParams = {
  readonly text: string;
};

const framesOffHead = ({ text }: TextParams): number =>
  Math.max(
    0,
    countMatches({ text, pattern: FRAME_OPENING }) - countMatches({ text, pattern: DOCK_FRAME }),
  );

const ownGrips = ({ text }: TextParams): number => countMatches({ text, pattern: OWN_GRIP });

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().flatMap(({ path, text }) => {
        if (DOCK_PANELS.includes(path)) {
          return [[path, framesOffHead({ text }) + ownGrips({ text })]];
        }
        return [];
      }),
    ),
  });

describe('every dock panel starts with one head', () => {
  it('counts a frame that is not in dock mode and a grip a panel draws itself', () => {
    expect(framesOffHead({ text: '<DrawerFrame title="Ask" onClose={f}>' })).toBe(1);
    expect(framesOffHead({ text: '<DrawerFrame isDock title="Ask" onClose={f}>' })).toBe(0);
    expect(ownGrips({ text: '<GripVertical size={14} />' })).toBe(1);
    expect(ownGrips({ text: 'const grip = useDockGrip();' })).toBe(1);
  });

  it('keeps Terminal, Browser, Scripts, Ask and Monitor on DockPanelHead with no grip icon', () => {
    const paths = new Set(productSources().map(({ path }) => path));
    expect(DOCK_PANELS.filter((path) => !paths.has(path))).toEqual([]);
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `A dock panel opens its DrawerFrame with isDock so DockPanelHead draws the head, and the whole head is the handle: no grip icon, no useDockGrip in the panel.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
