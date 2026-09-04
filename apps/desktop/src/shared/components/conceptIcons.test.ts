import { describe, expect, it } from 'vitest';
import { Folder, FolderGit2, ListVideo, SquareTerminal } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE, projectGlyph } from './conceptIcons';

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

  it('separates a mounted project from the project itself', () => {
    expect(CONCEPT_ICONS.mount).not.toBe(CONCEPT_ICONS.projectRepo);
    expect(CONCEPT_ICONS.mount).not.toBe(CONCEPT_ICONS.projectFolder);
  });

  it('gives each run outcome its own glyph', () => {
    const outcomes = [
      CONCEPT_ICONS.runPending,
      CONCEPT_ICONS.runDone,
      CONCEPT_ICONS.runFailed,
      CONCEPT_ICONS.runCancelled,
    ];
    expect(new Set(outcomes).size).toBe(outcomes.length);
  });
});

describe('ICON_SIZE', () => {
  it('exposes exactly the three sizes the app draws with', () => {
    expect(ICON_SIZE).toEqual({ row: 13, control: 14, hero: 18 });
  });
});

describe('projectGlyph', () => {
  it('marks a repo apart from a plain folder', () => {
    expect(projectGlyph({ kind: 'repo' })).toBe(FolderGit2);
    expect(projectGlyph({ kind: 'folder' })).toBe(Folder);
    expect(projectGlyph({ kind: null })).toBe(Folder);
  });
});
