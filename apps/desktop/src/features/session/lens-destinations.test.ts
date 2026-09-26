import { describe, expect, it } from 'vitest';
import { lensDestinations, type ConnectedLensTools } from './lens-destinations';
import { SHORTCUTS, type ShortcutId } from '../../shared/keyboard/registry';

const LENS_SHORTCUT_IDS = (Object.keys(SHORTCUTS) as ReadonlyArray<ShortcutId>).filter((id) =>
  id.startsWith('lens.'),
);

const REGION_ONLY_SHORTCUTS = new Set<ShortcutId>(['lens.goal', 'lens.decisions', 'lens.summary']);

const NO_CONNECTED_TOOLS: ConnectedLensTools = {
  linear: false,
  gitlab: false,
  jira: false,
  slack: false,
};

const ALL_TOOLS: ConnectedLensTools = { linear: true, gitlab: true, jira: true, slack: true };

type LensesParams = {
  readonly isBranchless?: boolean;
  readonly isGithubCodeHost?: boolean;
  readonly connectedTools?: ConnectedLensTools;
};

const lenses = ({
  isBranchless = false,
  isGithubCodeHost = false,
  connectedTools = NO_CONNECTED_TOOLS,
}: LensesParams = {}) =>
  lensDestinations({ isBranchless, isGithubCodeHost, connectedTools }).map((d) => d.lens);

describe('lensDestinations', () => {
  it('offers every destination chord, and leaves the context parts to their region', () => {
    const offered = new Set(
      [
        ...lensDestinations({
          isBranchless: false,
          isGithubCodeHost: false,
          connectedTools: ALL_TOOLS,
        }),
        ...lensDestinations({
          isBranchless: true,
          isGithubCodeHost: false,
          connectedTools: ALL_TOOLS,
        }),
      ].map((destination) => destination.shortcut),
    );

    for (const id of LENS_SHORTCUT_IDS) {
      if (REGION_ONLY_SHORTCUTS.has(id)) {
        expect(offered.has(id), `${id} opens its region, not a menu entry`).toBe(false);
        continue;
      }
      expect(offered.has(id), `${id} has a chord but no palette destination`).toBe(true);
    }
  });

  it('never names a chord the registry does not bind', () => {
    for (const destination of lensDestinations({
      isBranchless: false,
      isGithubCodeHost: false,
      connectedTools: ALL_TOOLS,
    })) {
      expect(SHORTCUTS[destination.shortcut], destination.shortcut).toBeDefined();
    }
  });

  it('lists one Context entry', () => {
    const offered = lenses();

    expect(offered.filter((lens) => lens === 'context')).toHaveLength(1);
    expect(offered).not.toContain('goal');
    expect(offered).not.toContain('decisions');
    expect(offered).not.toContain('last_output_summary');
  });

  it('always lists Explore and lists the diff only when mounted', () => {
    expect(lenses()).toContain('explore');
    expect(lenses()).toContain('files');
    expect(lenses({ isBranchless: true })).toContain('explore');
    expect(lenses({ isBranchless: true })).not.toContain('files');
  });

  it('hides the code host lens on GitHub, where Review owns pull requests', () => {
    expect(lenses({ isGithubCodeHost: true })).not.toContain('pr');
    expect(lenses({ isGithubCodeHost: false })).toContain('pr');
  });

  it('lists a tool lens only when that tool is connected', () => {
    expect(lenses()).not.toContain('linear');
    expect(lenses()).not.toContain('slack_threads');
    const linearOnly = lenses({ connectedTools: { ...NO_CONNECTED_TOOLS, linear: true } });
    expect(linearOnly).toContain('linear');
    expect(linearOnly).not.toContain('jira_issues');
  });

  it('hides the code host and issue trackers from a branchless session', () => {
    const branchless = lenses({ isBranchless: true, connectedTools: ALL_TOOLS });

    expect(branchless).not.toContain('pr');
    expect(branchless).not.toContain('linear');
    expect(branchless).not.toContain('terminal');
    expect(branchless).toContain('plans');
  });

  it('always offers the overview first', () => {
    expect(lenses({ isBranchless: true })[0]).toBeNull();
  });
});
