// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '../../shared/keyboard/registry';
import { LENS_ICON } from './lens-labels';
import { columnPagesOf, pagesOf } from './pageRegistry';

describe('the session level pages', () => {
  it('read Overview, Changes, Runs, Artifacts on every session', () => {
    expect(columnPagesOf().map((page) => page.label)).toEqual([
      'Overview',
      'Changes',
      'Runs',
      'Artifacts',
    ]);
  });

  it('fold Orchestrated into the one Runs entry', () => {
    const runs = columnPagesOf().find((page) => page.id === 'runs');
    expect(runs).toMatchObject({ lens: 'workflows', count: 'runs', shortcut: 'lens.workflows' });
    expect(runs?.currentLenses).toEqual(['workflows', 'orchestrated']);
  });

  it('leave the branch entries to the pull request page', () => {
    const labels = pagesOf({ hasOpenQuestions: true }).map((page) => page.label);
    for (const child of ['Branch', 'Comments', 'Files', 'Commits', 'Checks', 'Pull request']) {
      expect(labels).not.toContain(child);
    }
  });

  it('add Questions after Artifacts while something is open and Context last', () => {
    const closed = pagesOf({ hasOpenQuestions: false });
    const open = pagesOf({ hasOpenQuestions: true });

    expect(closed.map((page) => page.id)).not.toContain('questions');
    expect(open.map((page) => page.id)).toEqual([
      'overview',
      'files',
      'runs',
      'artifacts',
      'questions',
      'context',
    ]);
  });
});

describe('the page registry', () => {
  const every = pagesOf({ hasOpenQuestions: true });

  it('names every page after its shortcut', () => {
    for (const page of every) {
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
      'files',
      'runs',
      'artifacts',
      'questions',
    ]);
  });
});
