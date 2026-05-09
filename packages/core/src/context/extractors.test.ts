import { describe, expect, it } from 'vitest';
import type { TurnEvent } from '@kay-am/types';
import { extractFilesTouched, extractMarkers, mergeIntoSlot } from './extractors';

function fileEdit(path: string): TurnEvent {
  return {
    kind: 'file_edit',
    runId: 'r1' as TurnEvent extends { runId: infer R } ? R : never,
    path,
    editType: 'modify',
    at: '2026-05-09T00:00:00Z' as TurnEvent extends { at: infer A } ? A : never,
  } as TurnEvent;
}

function noise(): TurnEvent {
  return {
    kind: 'assistant_text',
    runId: 'r1',
    delta: 'noise',
    at: '2026-05-09T00:00:00Z',
  } as unknown as TurnEvent;
}

describe('extractFilesTouched', () => {
  it('returns empty for no events', () => {
    expect(extractFilesTouched([])).toEqual([]);
  });

  it('collects unique paths', () => {
    const events = [fileEdit('a.ts'), fileEdit('b.ts'), fileEdit('a.ts')];
    expect(extractFilesTouched(events)).toEqual(['a.ts', 'b.ts']);
  });

  it('ignores non-file_edit events', () => {
    const events = [noise(), fileEdit('a.ts'), noise()];
    expect(extractFilesTouched(events)).toEqual(['a.ts']);
  });

  it('preserves first-seen order', () => {
    const events = [fileEdit('z'), fileEdit('a'), fileEdit('m')];
    expect(extractFilesTouched(events)).toEqual(['z', 'a', 'm']);
  });
});

describe('extractMarkers', () => {
  it('returns empty arrays when text has no markers', () => {
    const out = extractMarkers('hello world, no markers here');
    expect(out.decisions).toEqual([]);
    expect(out.questions).toEqual([]);
  });

  it('extracts a single decision marker', () => {
    const text =
      'analysis complete. <<ctx-decision>>switch to OAuth2 PKCE<</ctx-decision>> proceeding.';
    expect(extractMarkers(text).decisions).toEqual(['switch to OAuth2 PKCE']);
  });

  it('extracts multiple markers of each type', () => {
    const text = `
      <<ctx-decision>>use sqlite for local persistence<</ctx-decision>>
      <<ctx-question>>do we need wal mode?<</ctx-question>>
      <<ctx-decision>>tauri 2 over electron<</ctx-decision>>
    `;
    const out = extractMarkers(text);
    expect(out.decisions).toEqual(['use sqlite for local persistence', 'tauri 2 over electron']);
    expect(out.questions).toEqual(['do we need wal mode?']);
  });

  it('trims whitespace inside markers', () => {
    const text = '<<ctx-decision>>   indented decision   <</ctx-decision>>';
    expect(extractMarkers(text).decisions).toEqual(['indented decision']);
  });

  it('handles multi-line content inside markers', () => {
    const text = `<<ctx-decision>>line one
line two
line three<</ctx-decision>>`;
    expect(extractMarkers(text).decisions[0]).toContain('line one');
    expect(extractMarkers(text).decisions[0]).toContain('line three');
  });

  it('drops empty markers', () => {
    const text = '<<ctx-decision>>   <</ctx-decision>><<ctx-decision>>real one<</ctx-decision>>';
    expect(extractMarkers(text).decisions).toEqual(['real one']);
  });

  it('regex state survives repeat calls (no leaked lastIndex)', () => {
    const text = '<<ctx-decision>>x<</ctx-decision>>';
    expect(extractMarkers(text).decisions).toEqual(['x']);
    expect(extractMarkers(text).decisions).toEqual(['x']);
    expect(extractMarkers(text).decisions).toEqual(['x']);
  });
});

describe('mergeIntoSlot', () => {
  it('returns existing verbatim when no additions', () => {
    expect(mergeIntoSlot('hello', [])).toBe('hello');
  });

  it('appends new lines to empty slot', () => {
    expect(mergeIntoSlot('', ['a', 'b'])).toBe('a\nb');
  });

  it('dedups against existing lines', () => {
    expect(mergeIntoSlot('a\nb', ['b', 'c'])).toBe('a\nb\nc');
  });

  it('returns original string when all additions are duplicates (no change)', () => {
    const original = 'a\nb';
    const result = mergeIntoSlot(original, ['a', 'b']);
    expect(result).toBe(original);
  });

  it('ignores blank additions', () => {
    expect(mergeIntoSlot('x', ['', '   ', 'y'])).toBe('x\ny');
  });

  it('treats whitespace-only as duplicate when stripped', () => {
    expect(mergeIntoSlot('foo', ['  foo  '])).toBe('foo');
  });
});
