// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '../../shared/keyboard/registry';
import { lensDestinations, type ConnectedLensTools } from './lens-destinations';
import { LENS_ICON } from './lens-labels';
import { columnPagesOf, pagesOf } from './pageRegistry';

const ALL_TOOLS: ConnectedLensTools = { linear: true, gitlab: true, jira: true, slack: true };

describe('the session level pages', () => {
  it('read Overview, Runs, Orchestrated, Agents, Artifacts in a session with a worktree', () => {
    expect(columnPagesOf({ isBranchless: false }).map((page) => page.label)).toEqual([
      'Overview',
      'Runs',
      'Orchestrated',
      'Agents',
      'Artifacts',
    ]);
  });

  it('add File versions after Overview in a branchless session', () => {
    expect(columnPagesOf({ isBranchless: true }).map((page) => page.label)).toEqual([
      'Overview',
      'File versions',
      'Runs',
      'Orchestrated',
      'Agents',
      'Artifacts',
    ]);
  });

  it('add Auto agents after Agents only while Auto is on or the session has one', () => {
    expect(
      columnPagesOf({ isBranchless: false, hasAutoAgents: true }).map((page) => page.label),
    ).toEqual(['Overview', 'Runs', 'Orchestrated', 'Agents', 'Auto agents', 'Artifacts']);
    const auto = columnPagesOf({ isBranchless: false, hasAutoAgents: true }).find(
      (page) => page.id === 'auto',
    );
    expect(auto).toMatchObject({ lens: 'auto', count: 'auto', shortcut: 'lens.agents' });
  });

  it('leave the branch entries to the worktree rows', () => {
    const labels = columnPagesOf({ isBranchless: false }).map((page) => page.label);
    for (const child of ['Branch', 'Comments', 'Files', 'Commits', 'Checks', 'Pull request']) {
      expect(labels).not.toContain(child);
    }
  });

  it('add Questions last, only while something is open', () => {
    const destinations = lensDestinations({ isBranchless: false, connectedTools: ALL_TOOLS });
    const closed = pagesOf({ isBranchless: false, destinations, hasOpenQuestions: false });
    const open = pagesOf({ isBranchless: false, destinations, hasOpenQuestions: true });

    expect(closed.map((page) => page.id)).not.toContain('questions');
    expect(open.map((page) => page.id).slice(0, 6)).toEqual([
      'overview',
      'runs',
      'orchestrated',
      'agents',
      'artifacts',
      'questions',
    ]);
  });
});

describe('the page registry', () => {
  const every = pagesOf({
    isBranchless: false,
    destinations: lensDestinations({ isBranchless: false, connectedTools: ALL_TOOLS }),
    hasOpenQuestions: true,
  });

  it('names every page after its shortcut except the linked records', () => {
    for (const page of every.filter(
      (candidate) => candidate.group !== 'linked' && candidate.id !== 'orchestrated',
    )) {
      expect(SHORTCUTS[page.shortcut].label, page.id).toBe(page.label);
    }
  });

  it('reaches Orchestrated with the Runs chord pressed again', () => {
    const orchestrated = every.find((page) => page.id === 'orchestrated');
    expect(orchestrated?.shortcut).toBe('lens.workflows');
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
      'runs',
      'orchestrated',
      'agents',
      'artifacts',
      'questions',
    ]);
  });
});
