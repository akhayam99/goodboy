// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CircleUser,
  Dashboard,
  Folder,
  FolderGit2,
  List,
  ListVideo,
  Lock,
  Milestone,
  Network,
  Plug,
  SquareKanban,
  SquareTerminal,
  Task,
} from '@goodboy/ui/icons';
import { CONCEPT_ICONS, CONCEPT_TONE, projectGlyph } from './conceptIcons';
import { ICON_SIZE, ICON_WEIGHT } from '@goodboy/ui';

describe('CONCEPT_TONE', () => {
  it('uses the draft tone for plans', () => {
    expect(CONCEPT_TONE.plans).toBe('draft');
  });

  it('gives every concept a tone', () => {
    const withoutTone = Object.keys(CONCEPT_ICONS).filter(
      (concept) => !Object.prototype.hasOwnProperty.call(CONCEPT_TONE, concept),
    );
    expect(withoutTone).toEqual([]);
  });

  it('never tones a concept that has no glyph', () => {
    const withoutGlyph = Object.keys(CONCEPT_TONE).filter(
      (concept) => !Object.prototype.hasOwnProperty.call(CONCEPT_ICONS, concept),
    );
    expect(withoutGlyph).toEqual([]);
  });
});

describe('CONCEPT_ICONS', () => {
  it('keeps scripts and terminal visually distinct', () => {
    expect(CONCEPT_ICONS.scripts).toBe(ListVideo);
    expect(CONCEPT_ICONS.terminal).toBe(SquareTerminal);
  });

  it('keeps Ask this session apart from the Chat door and from Questions', () => {
    expect(CONCEPT_ICONS.ask).not.toBe(CONCEPT_ICONS.chat);
    expect(CONCEPT_ICONS.ask).not.toBe(CONCEPT_ICONS.questions);
  });

  it('draws the Lead as Orchestrate, one glyph with the orchestrator it replaced', () => {
    expect(CONCEPT_ICONS.auto).toBe(Network);
    expect(CONCEPT_ICONS.orchestrator).toBe(Network);
  });

  it('keeps the Board and the Overview of one session on two glyphs', () => {
    expect(CONCEPT_ICONS.board).toBe(SquareKanban);
    expect(CONCEPT_ICONS.sessions).toBe(Dashboard);
  });

  it('draws each concept with the glyph its convention names', () => {
    expect(CONCEPT_ICONS.approval).toBe(Lock);
    expect(CONCEPT_ICONS.timeline).toBe(List);
    expect(CONCEPT_ICONS.changelog).toBe(Milestone);
    expect(CONCEPT_ICONS.inbox).toBe(Task);
    expect(CONCEPT_ICONS.integrations).toBe(Plug);
    expect(CONCEPT_ICONS.needsYou).toBe(CircleUser);
  });

  it('draws the Lead as Orchestrate, one glyph with the orchestrator it replaced', () => {
    expect(CONCEPT_ICONS.auto).toBe(Network);
    expect(CONCEPT_ICONS.orchestrator).toBe(Network);
  });

  it('keeps the Board and the Overview of one session on two glyphs', () => {
    expect(CONCEPT_ICONS.board).toBe(SquareKanban);
    expect(CONCEPT_ICONS.sessions).toBe(Dashboard);
  });

  it('draws each concept with the glyph its convention names', () => {
    expect(CONCEPT_ICONS.approval).toBe(Lock);
    expect(CONCEPT_ICONS.timeline).toBe(List);
    expect(CONCEPT_ICONS.changelog).toBe(Milestone);
    expect(CONCEPT_ICONS.inbox).toBe(Task);
    expect(CONCEPT_ICONS.integrations).toBe(Plug);
    expect(CONCEPT_ICONS.needsYou).toBe(CircleUser);
  });

  it('separates a mounted project from the project itself', () => {
    expect(CONCEPT_ICONS.mount).not.toBe(CONCEPT_ICONS.projectRepo);
    expect(CONCEPT_ICONS.mount).not.toBe(CONCEPT_ICONS.projectFolder);
  });

  it('gives each run outcome its own glyph', () => {
    const outcomes = [
      CONCEPT_ICONS.runPending,
      CONCEPT_ICONS.runDone,
      CONCEPT_ICONS.runFailed,
      CONCEPT_ICONS.runBlocked,
      CONCEPT_ICONS.runCancelled,
      CONCEPT_ICONS.runStopped,
    ];
    expect(new Set(outcomes).size).toBe(outcomes.length);
  });

  it('keeps a stopped run calm and a blocked run a warning', () => {
    expect(CONCEPT_TONE.runStopped).toBe('neutral');
    expect(CONCEPT_TONE.runBlocked).toBe('warning');
  });
});

describe('ICON_SIZE', () => {
  it('exposes exactly the five sizes the app draws with, with no hole between 10 and 18', () => {
    expect(ICON_SIZE).toEqual({ mark: 10, row: 12, control: 14, notice: 16, hero: 18 });
  });

  it('gives each size one weight and checks a heavier one', () => {
    expect(ICON_WEIGHT).toEqual({
      mark: 'bold',
      row: 'bold',
      control: 'regular',
      notice: 'regular',
      hero: 'regular',
      check: 'bold',
    });
  });

  it('keeps every size even so a glyph centres on whole pixels in an even badge', () => {
    expect(Object.values(ICON_SIZE).filter((size) => size % 2 !== 0)).toEqual([]);
  });
});

describe('projectGlyph', () => {
  it('marks a repo apart from a plain folder', () => {
    expect(projectGlyph({ kind: 'repo' })).toBe(FolderGit2);
    expect(projectGlyph({ kind: 'folder' })).toBe(Folder);
    expect(projectGlyph({ kind: null })).toBe(Folder);
  });
});
