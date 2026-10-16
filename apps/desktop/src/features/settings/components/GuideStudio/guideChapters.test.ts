// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/names';
import { COLUMN_DOORS } from '../../../../app/components/SideColumn/columnDoors';
import { columnPagesOf } from '../../../session/pageRegistry';
import { NEW_DRAWER_FORMS } from '../../../session/newDrawerForms';
import { GUIDE_CHAPTERS } from './guideChapters';

const CONCEPTS_DOC = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'docs',
  'concepts.md',
);

const stem = (word: string): string => word.toLowerCase().replace(/s$/, '');

const nameValues = (): ReadonlyArray<string> => [
  ...Object.values(NAMES).flatMap((value) => (typeof value === 'string' ? [value] : [])),
  ...Object.values(NAMES.role),
];

const conceptList = (): ReadonlyArray<string> => {
  const glance =
    /## At a glance\n([\s\S]*?)\n## /.exec(readFileSync(CONCEPTS_DOC, 'utf8'))?.[1] ?? '';
  return Array.from(glance.matchAll(/^- \*\*([^*]+)\*\*/gm), (match) => match[1] ?? '');
};

const KNOWN = new Set([...nameValues(), ...Object.keys(CONCEPT_ICONS), ...conceptList()].map(stem));

const words = GUIDE_CHAPTERS.find((chapter) => chapter.id === 'words');

describe('the Words chapter', () => {
  it('sits second in Start here, after What is Goodboy', () => {
    const start = GUIDE_CHAPTERS.filter((chapter) => chapter.group === 'start');
    expect(start.map((chapter) => chapter.id)).toEqual(['overview', 'words']);
    expect(GUIDE_CHAPTERS[1]?.id).toBe('words');
  });

  it('defines the nine words, each in one sentence', () => {
    expect(words?.points.map((point) => point.term)).toEqual([
      'Workspace',
      'Project',
      'Session',
      'Agent',
      'Turn',
      'Run',
      'Worktree and branch',
      'Plan',
      'Budget',
    ]);
    const notOneSentence = (words?.points ?? []).filter(
      (point) => point.desc.split(/(?<=[.?!])\s+/).length > 2,
    );
    expect(notOneSentence.map((point) => point.term)).toEqual([]);
  });

  it('uses only terms that are a known name or a concept', () => {
    expect(KNOWN.size).toBeGreaterThan(20);
    const unknown = (words?.points ?? [])
      .flatMap((point) => point.term.split(' and '))
      .filter((term) => !KNOWN.has(stem(term)));
    expect(unknown).toEqual([]);
  });

  it('writes no dash and no first person', () => {
    const text = [words?.lead ?? '', ...(words?.points ?? []).map((point) => point.desc)].join(' ');
    const dashes = [8211, 8212].map((code) => String.fromCharCode(code));
    expect(dashes.filter((dash) => text.includes(dash))).toEqual([]);
    expect(text).not.toMatch(/\b(I|we|my|our)\b/i);
  });
});

const chapterText = (id: string): string => {
  const chapter = GUIDE_CHAPTERS.find((candidate) => candidate.id === id);
  return [
    chapter?.lead ?? '',
    chapter?.note?.desc ?? '',
    ...(chapter?.points ?? []).flatMap((point) => [point.term, point.desc]),
  ].join('\n');
};

const allText = (): string => GUIDE_CHAPTERS.map((chapter) => chapterText(chapter.id)).join('\n');

const pointOf = (id: string, term: string): string =>
  GUIDE_CHAPTERS.find((chapter) => chapter.id === id)?.points.find((point) => point.term === term)
    ?.desc ?? '';

describe('the shell chapter', () => {
  it('follows the Board and names the three places of the 0.27 shell', () => {
    const ids = GUIDE_CHAPTERS.map((chapter) => chapter.id);
    expect(ids.indexOf('shell')).toBe(ids.indexOf('board') + 1);
    expect(
      GUIDE_CHAPTERS.find((chapter) => chapter.id === 'shell')?.points.map((p) => p.term),
    ).toEqual(
      expect.arrayContaining([
        'Sidebar',
        'Hide the sidebar',
        'Session rail',
        'Levels',
        'Fold the rail',
        'Panes',
        'Ask',
        'Terminal, Explore and Scripts',
      ]),
    );
  });

  it('lists every door of the sidebar by the name the sidebar draws', () => {
    const sidebar = pointOf('shell', 'Sidebar');
    COLUMN_DOORS.forEach((door) => expect(sidebar).toContain(door.label));
    expect(sidebar).toContain('New session');
    expect(sidebar).toContain('Pinned and Sessions');
    expect(sidebar).toContain('never changes level');
  });

  it('lists every page of the session rail by its registry label', () => {
    const rail = pointOf('shell', 'Session rail');
    columnPagesOf({ isBranchless: false, hasAutoAgents: true }).forEach((page) =>
      expect(rail).toContain(page.label),
    );
    expect(rail).toContain('Questions');
    expect(rail).toContain('Experimental');
    expect(rail).toContain('Projects');
    expect(rail).toContain('Linked');
  });

  it('drills the rail through a branch, a run and Auto, with the back row and the key', () => {
    const levels = pointOf('shell', 'Levels');
    ['Pull request', 'Comments', 'Files', 'Commits', 'Checks'].forEach((entry) =>
      expect(levels).toContain(entry),
    );
    expect(levels).toContain('‹ Runs');
    expect(levels).toContain('⌘[');
    expect(levels).toContain('The session level has no back row');
  });

  it('folds the rail with its own toggle, apart from the sidebar', () => {
    const fold = pointOf('shell', 'Fold the rail');
    expect(fold).toContain('Fold session rail');
    expect(fold).toContain('Show session rail');
    expect(fold).toContain('the sidebar folds first and then the rail');
    expect(pointOf('shell', 'Hide the sidebar')).toContain('⌘B');
    expect(pointOf('shell', 'Hide the sidebar')).toContain('only the sidebar');
  });

  it('names the pane buttons and the More panes menu', () => {
    const panes = pointOf('shell', 'Panes');
    ['Ask', 'Terminal', 'Explore', 'More panes', 'Context', 'Scripts'].forEach((pane) =>
      expect(panes).toContain(pane),
    );
    expect(pointOf('shell', 'Terminal, Explore and Scripts')).toContain('Terminal folder');
  });
});

describe('the start and agent chapters', () => {
  it('names the four ways to start a session and the Projects picker', () => {
    const start = pointOf('kickoff', 'Four ways to start');
    ['Pick up a task', 'Run a workflow', 'Orchestrate', 'Ask an agent'].forEach((choice) =>
      expect(start).toContain(choice),
    );
    expect(pointOf('kickoff', 'Projects')).toContain('Suggested');
    expect(pointOf('kickoff', 'Projects')).toContain('All projects');
    expect(NEW_DRAWER_FORMS.orchestrate.title).toBe('Orchestrate');
  });

  it('lists the New menu forms by their titles', () => {
    const menu = pointOf('agents', 'New menu');
    Object.values(NEW_DRAWER_FORMS).forEach((form) => expect(menu).toContain(form.title));
  });

  it('tells Orchestrated from Auto', () => {
    const orchestrated = pointOf('agents', 'Orchestrated');
    expect(orchestrated).toContain('orchestrator model picks each next step');
    expect(orchestrated).toContain('Hint the orchestrator');
    expect(orchestrated).toContain('Read now');
    const auto = pointOf('agents', 'Auto');
    expect(auto).toContain('experimental');
    expect(auto).toContain('Spend cap');
    expect(auto).toContain('child agents');
    const both = pointOf('agents', 'Orchestrated or Auto');
    expect(both).toContain('Orchestrated is not Auto');
    expect(both).toContain('Experimental chip');
  });
});

describe('what the 0.27 shell removed', () => {
  it('mentions none of it in any chapter', () => {
    const text = allText();
    [
      'LinkedTaskChip',
      'RunModeBar',
      '‹ Sessions',
      'Back to Sessions',
      'left column',
      'task chip',
      'Stop tracking',
      'New drawer',
      'Context drawer',
    ].forEach((removed) => expect(text).not.toContain(removed));
  });

  it('writes no em dash and no en dash in any chapter', () => {
    const dashes = [8211, 8212].map((code) => String.fromCharCode(code));
    expect(dashes.filter((dash) => allText().includes(dash))).toEqual([]);
  });
});
