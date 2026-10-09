// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { CrumbMenuModel, CrumbMenuRow } from '@goodboy/ui';
import { SHORTCUTS } from '../../shared/keyboard/registry';
import { lensDestinations, type ConnectedLensTools } from './lens-destinations';
import { LENS_ICON } from './lens-labels';
import type { PageSummaries } from './pageCountWord';
import { columnPagesOf, pagesOf } from './pageRegistry';
import { pageMenu } from './trail/menus/pageMenu';

const NO_TOOLS: ConnectedLensTools = { linear: false, gitlab: false, jira: false, slack: false };
const ALL_TOOLS: ConnectedLensTools = { linear: true, gitlab: true, jira: true, slack: true };

type MenuParams = {
  readonly isBranchless?: boolean;
  readonly connectedTools?: ConnectedLensTools;
  readonly summaries?: PageSummaries;
};

const menuOf = ({
  isBranchless = false,
  connectedTools = NO_TOOLS,
  summaries = {},
}: MenuParams = {}): CrumbMenuModel =>
  pageMenu({
    destinations: lensDestinations({ isBranchless, connectedTools }),
    activeLens: null,
    isBranchless,
    sessionTitle: 'Retry failed webhook deliveries',
    summaries,
    actions: [],
    onSelect: () => undefined,
  });

const rowsOf = (menu: CrumbMenuModel): ReadonlyArray<CrumbMenuRow> =>
  menu.groups.flatMap((group) => group.rows);

const labelsOf = (menu: CrumbMenuModel): ReadonlyArray<string> =>
  rowsOf(menu).map((row) => row.label);

const groupLabelsOf = (menu: CrumbMenuModel, groupId: string): ReadonlyArray<string> =>
  (menu.groups.find((group) => group.id === groupId)?.rows ?? []).map((row) => row.label);

describe('the sidebar column rows and the first five Pages menu rows', () => {
  it.each([false, true])('are the same pages with isBranchless %s', (isBranchless) => {
    const column = columnPagesOf({ isBranchless });
    const menuRows = rowsOf(menuOf({ isBranchless })).slice(0, 5);

    expect(menuRows.map((row) => row.label)).toEqual(column.map((page) => page.label));
    expect(menuRows.map((row) => row.id)).toEqual(column.map((page) => page.id));
    expect(menuRows.map((row) => (row.lead.kind === 'icon' ? row.lead.icon : null))).toEqual(
      column.map((page) => page.icon),
    );
    const registry = pagesOf({
      isBranchless,
      destinations: lensDestinations({ isBranchless, connectedTools: NO_TOOLS }),
      hasOpenQuestions: false,
    });
    expect(registry.slice(0, 5).map((page) => page.shortcut)).toEqual(
      column.map((page) => page.shortcut),
    );
  });

  it('read Overview, Branch, Runs, Agents, Artifacts', () => {
    expect(columnPagesOf({ isBranchless: false }).map((page) => page.label)).toEqual([
      'Overview',
      'Branch',
      'Runs',
      'Agents',
      'Artifacts',
    ]);
  });

  it('read File versions in place of Branch without a mount', () => {
    expect(columnPagesOf({ isBranchless: true }).map((page) => page.label)).toEqual([
      'Overview',
      'File versions',
      'Runs',
      'Agents',
      'Artifacts',
    ]);
  });

  it('leave the branch child rows of the column out of the menu', () => {
    const labels = labelsOf(menuOf({ connectedTools: ALL_TOOLS }));
    for (const child of ['Comments', 'Files', 'Commits', 'Checks', 'Pull request']) {
      expect(labels).not.toContain(child);
    }
  });
});

describe('the Pages menu', () => {
  it('starts with Overview and has no Review, Diff or Pull request row', () => {
    const labels = labelsOf(menuOf({ connectedTools: ALL_TOOLS }));

    expect(labels[0]).toBe('Overview');
    expect(labels).not.toContain('Session');
    expect(labels).not.toContain('Review');
    expect(labels).not.toContain('Diff');
    expect(labels).not.toContain('Pull request');
  });

  it('lands the Branch row on the review door', () => {
    const branch = columnPagesOf({ isBranchless: false })[1];
    expect(branch?.lens).toBe('review');
    expect(branch?.currentLenses).toEqual(['branch', 'review', 'pr', 'files']);
  });

  it('shows Questions only while something is open, after Artifacts', () => {
    expect(labelsOf(menuOf())).not.toContain('Questions');
    const open = labelsOf(menuOf({ summaries: { questions: '2 open' } }));
    expect(open.slice(0, 6)).toEqual([
      'Overview',
      'Branch',
      'Runs',
      'Agents',
      'Artifacts',
      'Questions',
    ]);
  });

  it('groups Explore, Scripts and Terminal as Tools', () => {
    const menu = menuOf();

    expect(menu.groups.map((group) => group.label)).toEqual([null, 'Tools']);
    expect(groupLabelsOf(menu, 'tools')).toEqual(['Explore', 'Scripts', 'Terminal']);
  });

  it('keeps the linked records group as it was', () => {
    expect(groupLabelsOf(menuOf({ connectedTools: ALL_TOOLS }), 'linked')).toEqual([
      'Linear',
      'GitLab',
      'Jira',
      'Slack',
    ]);
    expect(groupLabelsOf(menuOf(), 'linked')).toEqual([]);
  });

  it('keeps Explore and drops the code tools from a branchless session', () => {
    const menu = menuOf({ isBranchless: true, connectedTools: ALL_TOOLS });

    expect(groupLabelsOf(menu, 'tools')).toEqual(['Explore']);
    expect(groupLabelsOf(menu, 'linked')).toEqual([]);
  });

  it('carries the count word of a page on its row', () => {
    const rows = rowsOf(menuOf({ summaries: { branch: '3 need you', runs: '2 running' } }));

    expect(rows.find((row) => row.label === 'Branch')?.metaA).toBe('3 need you');
    expect(rows.find((row) => row.label === 'Runs')?.metaA).toBe('2 running');
    expect(rows.find((row) => row.label === 'Agents')?.metaA).toBeNull();
  });
});

describe('the page registry', () => {
  const every = pagesOf({
    isBranchless: false,
    destinations: lensDestinations({ isBranchless: false, connectedTools: ALL_TOOLS }),
    hasOpenQuestions: true,
  });

  it('names every page after its shortcut except Branch and the linked records', () => {
    for (const page of every.filter((candidate) => candidate.group !== 'linked')) {
      if (page.id === 'branch') {
        continue;
      }
      expect(SHORTCUTS[page.shortcut].label, page.id).toBe(page.label);
    }
  });

  it('binds every page to a chord the registry owns', () => {
    for (const page of every) {
      expect(SHORTCUTS[page.shortcut], page.id).toBeDefined();
    }
  });

  it('draws the icon of the lens that the page opens', () => {
    for (const page of every) {
      if (page.lens !== null) {
        expect(page.icon, page.id).toBe(LENS_ICON[page.tint ?? page.lens]);
      }
    }
  });

  it('counts exactly the pages that the count grammar names', () => {
    expect(every.filter((page) => page.count !== null).map((page) => page.id)).toEqual([
      'branch',
      'runs',
      'agents',
      'artifacts',
      'questions',
    ]);
  });
});
