// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { lensDestinations, type ConnectedLensTools } from './lens-destinations';
import { SHORTCUTS, type ShortcutId } from '../../shared/keyboard/registry';

const LENS_SHORTCUT_IDS = Object.keys(SHORTCUTS)
  .filter((id): id is ShortcutId => id in SHORTCUTS)
  .filter((id) => id.startsWith('lens.'));

const NO_CONNECTED_TOOLS: ConnectedLensTools = {
  linear: false,
  gitlab: false,
  jira: false,
  slack: false,
};

const ALL_TOOLS: ConnectedLensTools = { linear: true, gitlab: true, jira: true, slack: true };

type LensesParams = {
  readonly isBranchless?: boolean;
  readonly isArchived?: boolean;
  readonly connectedTools?: ConnectedLensTools;
};

const lenses = ({
  isBranchless = false,
  isArchived = false,
  connectedTools = NO_CONNECTED_TOOLS,
}: LensesParams = {}) =>
  lensDestinations({ isBranchless, isArchived, connectedTools }).map((d) => d.pane ?? d.lens);

describe('lensDestinations', () => {
  it('offers every destination chord', () => {
    const offered = new Set(
      [
        ...lensDestinations({
          isBranchless: false,
          connectedTools: ALL_TOOLS,
        }),
        ...lensDestinations({
          isBranchless: true,
          connectedTools: ALL_TOOLS,
        }),
      ].map((destination) => destination.shortcut),
    );

    for (const id of LENS_SHORTCUT_IDS) {
      expect(offered.has(id), `${id} has a chord but no palette destination`).toBe(true);
    }
  });

  it('never names a chord the registry does not bind', () => {
    for (const destination of lensDestinations({
      isBranchless: false,
      connectedTools: ALL_TOOLS,
    })) {
      expect(SHORTCUTS[destination.shortcut], destination.shortcut).toBeDefined();
    }
  });

  it('lists the Context tab on every session, and none of its former parts', () => {
    expect(lenses()).toContain('context');
    expect(lenses({ isBranchless: true })).toContain('context');
    expect(lenses()).not.toContain('goal');
    expect(lenses()).not.toContain('decisions');
    expect(lenses()).not.toContain('last_output_summary');
  });

  it('lists Changes and its All files door on every session', () => {
    expect(lenses()).toContain('explore');
    expect(lenses()).toContain('files');
    expect(lenses({ isBranchless: true })).toContain('explore');
    expect(lenses({ isBranchless: true })).toContain('files');
  });

  it('lists the pull request apart from Review', () => {
    expect(lenses()).toContain('pr');
    expect(lenses()).toContain('review');
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

  it('offers no link-work destination for an archived session', () => {
    const live = lenses({ connectedTools: ALL_TOOLS });
    const archived = lenses({ isArchived: true, connectedTools: ALL_TOOLS });

    expect(live).toContain('linear');
    expect(live).toContain('slack_threads');
    expect(archived).not.toContain('linear');
    expect(archived).not.toContain('gitlab_issues');
    expect(archived).not.toContain('jira_issues');
    expect(archived).not.toContain('slack_threads');
    expect(archived).toContain('review');
  });

  it('always offers the overview first', () => {
    expect(lenses({ isBranchless: true })[0]).toBeNull();
  });
});
