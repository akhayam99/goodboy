// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { NAMES } from '../../../../shared/utils/names';
import { RETIRED_NAMES } from '../../../../__tests__/regressions/retiredNames';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { COLUMN_DOORS } from '../../../../app/components/SideColumn/columnDoors';
import { columnPagesOf } from '../../../session/pageRegistry';
import { NEW_DRAWER_FORMS } from '../../../session/newDrawerForms';
import { chapterStatsOf } from './chapterStatsOf';
import { GUIDE_CHAPTERS, GUIDE_GROUP_LABEL, GUIDE_GROUP_ORDER } from './guideChapters';
import { resolveGuideChapter } from './resolveGuideChapter';

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

const wordsIn = (text: string): number => text.split(/\s+/).filter((word) => word !== '').length;

const chapterText = (id: string): string => {
  const chapter = GUIDE_CHAPTERS.find((candidate) => candidate.id === id);
  return [
    chapter?.title ?? '',
    chapter?.lead ?? '',
    chapter?.note?.term ?? '',
    chapter?.note?.desc ?? '',
    ...(chapter?.points ?? []).flatMap((point) => [point.term, point.desc]),
    ...(chapter?.links ?? []).map((link) => link.label),
  ].join('\n');
};

const allText = (): string => GUIDE_CHAPTERS.map((chapter) => chapterText(chapter.id)).join('\n');

const pointOf = (id: string, term: string): string =>
  GUIDE_CHAPTERS.find((chapter) => chapter.id === id)?.points.find((point) => point.term === term)
    ?.desc ?? '';

describe('the word budget', () => {
  it('keeps every lead to 35 words', () => {
    const long = GUIDE_CHAPTERS.filter((chapter) => wordsIn(chapter.lead) > 35);
    expect(long.map((chapter) => chapter.id)).toEqual([]);
  });

  it('keeps every point to 60 words', () => {
    const long = GUIDE_CHAPTERS.flatMap((chapter) =>
      [...chapter.points, ...(chapter.note === undefined ? [] : [chapter.note])]
        .filter((point) => wordsIn(point.desc) > 60)
        .map((point) => `${chapter.id}: ${point.term}`),
    );
    expect(long).toEqual([]);
  });

  it('keeps every chapter to 7 points, the Words glossary to 12', () => {
    const crowded = GUIDE_CHAPTERS.filter(
      (chapter) => chapter.points.length > (chapter.id === 'words' ? 12 : 7),
    );
    expect(crowded.map((chapter) => chapter.id)).toEqual([]);
  });

  it('keeps the whole Guide to 4,000 words, counted the way the chapter meta counts them', () => {
    const total = GUIDE_CHAPTERS.reduce(
      (sum, chapter) => sum + chapterStatsOf({ chapter }).words,
      0,
    );
    expect(total).toBeGreaterThan(2000);
    expect(total).toBeLessThanOrEqual(4000);
  });

  it('counts the lead, the note and the sentences of every point, as the audit did', () => {
    const words = GUIDE_CHAPTERS.find((chapter) => chapter.id === 'words');
    const expected =
      wordsIn(words?.lead ?? '') +
      (words?.points ?? []).reduce((sum, point) => sum + wordsIn(point.desc), 0);
    expect(words === undefined ? null : chapterStatsOf({ chapter: words })).toEqual({
      points: 12,
      words: expected,
    });
  });
});

describe('the chapter list', () => {
  it('holds 24 chapters in four groups, named for the screen they explain', () => {
    expect(GUIDE_GROUP_ORDER.map((group) => GUIDE_GROUP_LABEL[group])).toEqual([
      'Start here',
      'Daily work',
      'Housekeeping',
      'Reference',
    ]);
    const byGroup = GUIDE_GROUP_ORDER.map((group) =>
      GUIDE_CHAPTERS.filter((chapter) => chapter.group === group).map((chapter) => chapter.title),
    );
    expect(byGroup).toEqual([
      ['What is Goodboy', 'Words'],
      [
        'Workspaces and folders',
        'Folders without git',
        'Providers and limits',
        'New session',
        'Board',
        'Sidebar and session rail',
        'Agents and roles',
        'Workflows',
        'Shared context',
        'Tasks and integrations',
        'Review and the Branch page',
        'Commits',
        'Artifacts',
        'Impact',
        'Monitoring',
      ],
      ['Storage and cleanup', 'Settings and backup', 'Updates', 'Keyboard shortcuts'],
      ['How Goodboy listens', 'Tokens and cost', 'Tips', 'Legend'],
    ]);
    expect(GUIDE_CHAPTERS.map((chapter) => chapter.group)).toEqual(
      GUIDE_GROUP_ORDER.flatMap((group) =>
        GUIDE_CHAPTERS.filter((chapter) => chapter.group === group).map(() => group),
      ),
    );
    expect(new Set(GUIDE_CHAPTERS.map((chapter) => chapter.id)).size).toBe(25);
  });

  it('puts the chapter on folders without git right after Workspaces and folders', () => {
    const ids = GUIDE_CHAPTERS.map((chapter) => chapter.id);
    expect(ids.indexOf('plain-folders')).toBe(ids.indexOf('folders') + 1);
    expect(ids.indexOf('providers')).toBe(ids.indexOf('plain-folders') + 1);
  });
});

describe('deep links to a chapter', () => {
  it('opens a chapter by its id', () => {
    GUIDE_CHAPTERS.forEach((chapter) =>
      expect(resolveGuideChapter({ id: chapter.id }).id).toBe(chapter.id),
    );
  });

  it('maps the ids of renamed chapters to the chapter that took their place', () => {
    expect(
      ['workspace', 'history', 'tools'].map((id) => resolveGuideChapter({ id }).title),
    ).toEqual(['Workspaces and folders', 'Commits', 'Tasks and integrations']);
  });

  it('keeps the ids that hover cards, Impact and Storage link to', () => {
    expect(['legend', 'tokens', 'words'].map((id) => resolveGuideChapter({ id }).title)).toEqual([
      'Legend',
      'Tokens and cost',
      'Words',
    ]);
  });

  it('opens What is Goodboy for an unknown id or no id, never an empty page', () => {
    expect(resolveGuideChapter({ id: 'gone-chapter' }).id).toBe('overview');
    expect(resolveGuideChapter({ id: 'constructor' }).id).toBe('overview');
    expect(resolveGuideChapter({ id: null }).id).toBe('overview');
  });
});

describe('what the Guide may name', () => {
  it('names no version number', () => {
    expect(allText().match(/\b\d+\.\d+(\.\d+)?\b/g)).toBeNull();
  });

  it('names no page a feature flag hides', () => {
    const pages: ReadonlyArray<readonly [boolean, string]> = [
      [WORKSPACE_FEATURES.workflows, 'Workflows'],
      [WORKSPACE_FEATURES.skills, 'Skills'],
    ];
    const hidden = pages.filter(([isOn]) => !isOn).map(([, label]) => label);
    expect(hidden).toContain('Skills');
    hidden.forEach((label) => expect(allText()).not.toContain(label));
  });

  it('says folder for a Goodboy folder, never project, past the Projects card it names', () => {
    expect(
      allText()
        .replaceAll(`${NAMES.projects} card`, '')
        .match(/\bprojects?\b/gi),
    ).toBeNull();
  });

  it('names nothing the shell moved out of the top bar or renamed', () => {
    const text = allText();
    [
      'pulse icon',
      'Pinned port down',
      'Limits chips',
      'monthly cap',
      'Budget',
      'Keys from before',
      'LinkedTaskChip',
      'RunModeBar',
      '‹ Sessions',
      'Back to Sessions',
      'left column',
      'More panes',
      'New drawer',
      'Context drawer',
    ].forEach((removed) => expect(text).not.toContain(removed));
    expect(text).not.toMatch(/\bcap\b/i);
  });

  it('names no marker the session pages no longer draw', () => {
    expect(allText()).not.toMatch(/\b(?:Experimental|Deprecated)\b/);
  });

  it('writes no em dash and no en dash in any chapter', () => {
    const dashes = [8211, 8212].map((code) => String.fromCharCode(code));
    expect(dashes.filter((dash) => allText().includes(dash))).toEqual([]);
  });
});

describe('the labels the Guide cites', () => {
  const studioLinkLabel = ({ kind }: { readonly kind: string }): string | undefined =>
    GUIDE_CHAPTERS.flatMap((chapter) => chapter.links).find(
      (link) => link.target.kind === 'studio' && link.target.studio.kind === kind,
    )?.label;

  it('names the links to Tasks and What is new from names.ts', () => {
    expect(studioLinkLabel({ kind: 'inbox' })).toBe(`Open ${NAMES.tasks}`);
    expect(studioLinkLabel({ kind: 'changelog' })).toBe(`Open ${NAMES.whatsNew}`);
  });

  it('cites the button on an issue as it is drawn', () => {
    expect(pointOf('kickoff', 'Start from Tasks')).toContain(NAMES.startSession);
    expect(pointOf('tasks', 'Start from anything')).toContain(NAMES.startSession);
  });

  it('cites no name that the retired names guard flags', () => {
    const flagged = RETIRED_NAMES.filter((retired) => retired.pattern.test(allText()));
    expect(flagged.map((retired) => retired.id)).toEqual([]);
  });

  it('calls a session a session and keeps task for the work of other tools', () => {
    const text = allText();
    expect(text).not.toMatch(/\b(?:a session is one task|each task is a session|one task with)\b/i);
    expect(text).not.toMatch(/\bunblock the task\b|\bnext to the task\b/);
  });
});

describe('the shell chapter', () => {
  it('lists every door of the sidebar by the name the sidebar draws', () => {
    const sidebar = pointOf('shell', 'Sidebar');
    expect(sidebar).toContain('New session');
    COLUMN_DOORS.forEach((door) => expect(sidebar).toContain(door.label));
    expect(sidebar).toContain('amber dot');
    expect(sidebar).toContain('pinned port is down');
  });

  it('lists every page of the session rail by its registry label', () => {
    const rail = pointOf('shell', 'Session rail');
    columnPagesOf({ isBranchless: false }).forEach((page) => expect(rail).toContain(page.label));
    [NAMES.projects, 'Linked'].forEach((word) => expect(rail).toContain(word));
  });

  it('puts both adds on the rows they act on and Archive and Delete in the session menu', () => {
    const actions = pointOf('shell', 'Session actions and +');
    expect(actions).toContain('+ on the Projects card');
    expect(actions).toContain('+ on a folder row starts a new branch');
    expect(actions).toContain('More session actions');
    expect(actions).toContain('Archive and Delete');
  });

  it('shows what a run and Auto started in the Agents panel, with its key and no rail level', () => {
    const agents = pointOf('shell', 'Agents panel');
    [shortcutGlyphs('session.spawned'), 'run or Auto', 'j and k hop'].forEach((entry) =>
      expect(agents).toContain(entry),
    );
    expect(agents).not.toContain('‹ Runs');
  });

  it('opens a branch in place from the Projects card', () => {
    const branchPage = pointOf('review', 'Branch page');
    ['in place', 'Pull request', 'Comments', 'Files', 'Commits', 'Checks'].forEach((entry) =>
      expect(branchPage).toContain(entry),
    );
    expect(branchPage).not.toContain('steps into');
  });

  it('names the session tools in their column at the right of the page', () => {
    const tools = pointOf('shell', 'Session tools');
    ['Ask', 'Terminal', 'Explore', 'Context', 'Scripts', 'right of the session page'].forEach(
      (tool) => expect(tools).toContain(tool),
    );
    expect(tools).toContain('Fold session rail');
  });
});

describe('the start, agent and workflow chapters', () => {
  it('names the one way to start a session and the folder picker', () => {
    expect(pointOf('kickoff', 'What kind of run?')).toContain('Workflow or Agent');
    expect(pointOf('kickoff', NAMES.startARun)).toContain('Auto picks a workflow or an agent');
    expect(pointOf('kickoff', 'Start from Tasks')).toContain('Pick from Tasks');
    expect(pointOf('kickoff', 'Where')).toContain('Auto picks');
    expect(pointOf('kickoff', 'Where')).toContain('Suggested');
    expect(pointOf('kickoff', 'Where')).toContain('All folders');
  });

  it('lists the New menu forms by their titles', () => {
    const menu = pointOf('kickoff', 'New menu');
    Object.values(NEW_DRAWER_FORMS).forEach((form) => expect(menu).toContain(form.title));
  });

  it('tells Orchestrated from Auto', () => {
    const orchestrated = pointOf('workflows', 'Orchestrated');
    expect(orchestrated).toContain('orchestrator model picks each next step');
    expect(orchestrated).toContain('Hint the orchestrator');
    expect(orchestrated).toContain('Send now');
    const auto = pointOf('agents', 'Auto');
    expect(auto).toContain('Start a run');
    expect(auto).toContain('under a limit');
    expect(auto).toContain('child agents');
    const both = pointOf('workflows', 'Orchestrated or Auto');
    expect(both).toContain('Orchestrated is not Auto');
    expect(both).not.toContain('Experimental');
  });

  it('says a rebase conflict asks, and Rebase all hands the conflicts to one Auto', () => {
    const asks = pointOf('commits', 'A rebase conflict asks');
    ['Resolve with Auto', 'Resolve myself', 'Keep branch as it was', 'never pushes'].forEach(
      (word) => expect(asks).toContain(word),
    );
    const all = pointOf('commits', 'Rebase all');
    expect(all).toContain('one Auto run');
    expect(all).toContain('Also tidy commits with Auto');
  });

  it('says Next leaves the follow ups of a run to its Running row', () => {
    expect(pointOf('agents', 'Next')).toContain("that run's Running row");
  });

  it('names the five Overview cards and drops the Classic switch', () => {
    const cards = pointOf('agents', 'Overview cards');
    ['Needs you', 'Running', 'Next', 'Branches', 'Done'].forEach((card) =>
      expect(cards).toContain(card),
    );
    expect(cards).not.toContain('Classic');
  });
});

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
    expect(GUIDE_CHAPTERS.slice(0, 2).map((chapter) => chapter.id)).toEqual(['overview', 'words']);
  });

  it('defines folder and limit, never project or budget, each in one sentence', () => {
    expect(words?.points.map((point) => point.term)).toEqual([
      'Workspace',
      'Folder',
      'Session',
      'Agent',
      'Run',
      'Plan',
      'Preset',
      'Auto',
      'Scout',
      'Turn',
      'Worktree and branch',
      'Limit',
    ]);
    const notOneSentence = (words?.points ?? []).filter(
      (point) => point.desc.split(/(?<=[.?!])\s+/).length > 1,
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

  it('defines Run, Plan, Preset, Auto and Scout in one sentence each', () => {
    ['Run', 'Plan', 'Preset', 'Auto', 'Scout'].forEach((term) => {
      const desc = words?.points.find((point) => point.term === term)?.desc ?? '';
      expect(desc).not.toBe('');
      expect(desc.split(/(?<=[.?!])\s+/)).toHaveLength(1);
    });
    expect(pointOf('words', 'Preset')).toContain('workflow');
    expect(pointOf('words', 'Session')).not.toMatch(/\btask\b/);
  });

  it('writes no first person', () => {
    expect(allText()).not.toMatch(/\b(we|my|our)\b/i);
    expect(allText()).not.toMatch(/(^|\s)I\s/);
  });
});
