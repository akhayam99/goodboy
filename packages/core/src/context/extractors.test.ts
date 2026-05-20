import { describe, expect, it } from 'vitest';
import type { TurnEvent } from '@goodboy/types';
import {
  assessPlanReadiness,
  extractFilesTouched,
  extractHandoff,
  extractMarkers,
  extractPlanFromMarker,
  mergeIntoSlot,
} from './extractors';

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

describe('extractPlanFromMarker', () => {
  it('returns null when no plan marker present', () => {
    expect(extractPlanFromMarker('no plan here')).toBeNull();
  });

  it('extracts title from first non-empty line and body as markdown rest', () => {
    const text = `prose before. <<plan>>migrate auth to oauth2
- step 1: scaffolding
- step 2: token exchange<</plan>>`;
    expect(extractPlanFromMarker(text)).toEqual({
      title: 'migrate auth to oauth2',
      bodyMd: '- step 1: scaffolding\n- step 2: token exchange',
    });
  });

  it('strips leading # from title', () => {
    const text = `<<plan>>### refactor everything

body line.<</plan>>`;
    const out = extractPlanFromMarker(text);
    expect(out?.title).toBe('refactor everything');
    expect(out?.bodyMd).toBe('body line.');
  });

  it('falls back to title-as-body when body empty', () => {
    const text = '<<plan>>only title<</plan>>';
    expect(extractPlanFromMarker(text)).toEqual({
      title: 'only title',
      bodyMd: 'only title',
    });
  });

  it('returns null when marker content is whitespace only', () => {
    const text = '<<plan>>   \n  <</plan>>';
    expect(extractPlanFromMarker(text)).toBeNull();
  });

  it('picks the LAST plan when multiple emitted in a turn', () => {
    const text = `<<plan>>first
body 1<</plan>>
intermediate prose
<<plan>>final
body 2<</plan>>`;
    expect(extractPlanFromMarker(text)?.title).toBe('final');
  });

  it('survives repeat calls (no leaked lastIndex)', () => {
    const text = '<<plan>>x\nb<</plan>>';
    expect(extractPlanFromMarker(text)?.title).toBe('x');
    expect(extractPlanFromMarker(text)?.title).toBe('x');
    expect(extractPlanFromMarker(text)?.title).toBe('x');
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

describe('extractHandoff', () => {
  it('returns null when no marker is present', () => {
    expect(extractHandoff('just chat text')).toBeNull();
  });

  it('parses self-closing marker with quoted reason', () => {
    const text = 'plan emitted. <<handoff kind=implementer reason="plan ready" plan=abc>>';
    expect(extractHandoff(text)).toEqual({
      kind: 'implementer',
      reason: 'plan ready',
      planId: 'abc',
    });
  });

  it('parses without a plan attribute', () => {
    const text = '<<handoff kind=debugger reason="error reproduced">>';
    expect(extractHandoff(text)).toEqual({
      kind: 'debugger',
      reason: 'error reproduced',
      planId: null,
    });
  });

  it('rejects unknown kinds', () => {
    const text = '<<handoff kind=hacker reason=yo>>';
    expect(extractHandoff(text)).toBeNull();
  });

  it('returns the last marker when multiple appear', () => {
    const text =
      '<<handoff kind=scout reason="early">> ... <<handoff kind=implementer reason="final">>';
    expect(extractHandoff(text)?.kind).toBe('implementer');
  });
});

describe('assessPlanReadiness', () => {
  const body = '1. step one\n2. step two';

  it('marks ready when body has multiple steps and no open questions', () => {
    expect(
      assessPlanReadiness({ planBody: body, assistantText: `<<plan>>${body}<</plan>>` }),
    ).toEqual({ ready: true, reason: null });
  });

  it('rejects when body has TODO', () => {
    const b = '1. step one\n2. TODO refine';
    expect(assessPlanReadiness({ planBody: b, assistantText: '' }).reason).toBe(
      'incomplete-markers',
    );
  });

  it('rejects when body has only one step', () => {
    expect(assessPlanReadiness({ planBody: '1. only step', assistantText: '' }).reason).toBe(
      'too-few-steps',
    );
  });

  it('rejects when assistant text outside plan asks an open question', () => {
    const text = `<<plan>>${body}<</plan>>\n\nvuoi che continui?`;
    expect(assessPlanReadiness({ planBody: body, assistantText: text }).reason).toBe(
      'has-open-question',
    );
  });

  it('does not count open-question phrases that appear inside the plan body', () => {
    const text = `<<plan>>${body}\n\nshould i clarify before step 2?<</plan>>`;
    expect(assessPlanReadiness({ planBody: body, assistantText: text }).ready).toBe(true);
  });
});
