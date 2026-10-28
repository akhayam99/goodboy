import { describe, expect, it } from 'vitest';
import { canonicalizeMarkers } from './canonicalizeMarkers';
import {
  extractHandoff,
  extractMarkers,
  extractPlanFromMarker,
  extractStepDone,
  hasBlockingQuestion,
  stripControlMarkers,
} from './marker-parsing';

const canon = (text: string): string => canonicalizeMarkers({ text });

describe('canonicalizeMarkers', () => {
  it('leaves a clean marker and plain prose untouched', () => {
    const text = 'All done.\n\n<<step-done id="agent-1">>\n';
    expect(canon(text)).toBe(text);
    expect(canon('no markers, only l’agente and “quotes”.')).toBe(
      'no markers, only l’agente and “quotes”.',
    );
  });

  it('unescapes markdown escaped angle brackets', () => {
    expect(canon('\\<\\<step-done id="agent-1"\\>\\>')).toBe('<<step-done id="agent-1">>');
  });

  it('decodes html entities', () => {
    expect(canon('&lt;&lt;step-done id=&quot;agent-1&quot;&gt;&gt;')).toBe(
      '<<step-done id="agent-1">>',
    );
  });

  it('closes a marker that lost one closing bracket', () => {
    expect(canon('<<step-done id="agent-1">\nnext')).toBe('<<step-done id="agent-1">>\nnext');
  });

  it('removes spaces after the opening brackets and lowercases the name', () => {
    expect(canon('<< STEP-DONE id="agent-1">>')).toBe('<<step-done id="agent-1">>');
  });

  it('turns curly double quotes into the attribute quotes', () => {
    expect(canon('<<step-done id=“agent-1”>>')).toBe('<<step-done id="agent-1">>');
  });

  it('keeps a curly apostrophe inside an attribute value', () => {
    const text = '<<handoff kind=planner reason="l’agente ha finito">>';
    expect(canon(text)).toBe(text);
  });

  it('rewrites the closing tag of a block marker and keeps its content', () => {
    expect(canon('\\<\\<plan\\>\\>Fix ledger-core\n- step\\<\\</plan\\>\\>')).toBe(
      '<<plan>>Fix ledger-core\n- step<</plan>>',
    );
  });

  it('does not touch an angle bracket sequence that is not a known marker', () => {
    const text = 'cat <<EOF\\>\nand \\<div\\> stays';
    expect(canon(text)).toBe(text);
  });

  it('leaves a marker that spans lines alone', () => {
    const text = '\\<\\<handoff kind=planner\nreason="x"\\>\\>';
    expect(canon(text)).toBe(text);
  });
});

describe('marker extractors accept the forms providers print', () => {
  it('reads step-done in every wrapping', () => {
    const forms = [
      '<<step-done id="agent-1">>',
      '`<<step-done id="agent-1">>`',
      '```\n<<step-done id="agent-1">>\n```',
      '\\<\\<step-done id="agent-1"\\>\\>',
      '&lt;&lt;step-done id=&quot;agent-1&quot;&gt;&gt;',
      '<< step-done id = "agent-1" >>',
      "<<step-done id='agent-1'>>",
      '<<step-done id=agent-1>>',
      '<<step-done id=“agent-1”>>',
      '<<STEP-DONE id="agent-1">>',
      '<<step-done id="agent-1">',
    ];
    for (const form of forms) {
      expect(extractStepDone(`Report ready.\n\n${form}\n\nAnything after.`), form).toEqual({
        id: 'agent-1',
      });
    }
  });

  it('keeps the strict id: a bare marker and a prose mention without an id do not count', () => {
    expect(extractStepDone('<<step-done>>')).toBeNull();
    expect(extractStepDone('step not done: `<<step-done>>` not emitted yet')).toBeNull();
    expect(extractStepDone('<<step-done id="">>')).toBeNull();
  });

  it('returns the id of the marker so the step check can compare it', () => {
    expect(extractStepDone('<<step-done id="agent-2">>')).toEqual({ id: 'agent-2' });
  });

  it('reads a handoff in every wrapping', () => {
    const forms = [
      '<<handoff kind=planner reason="plan the fix">>',
      '`<<handoff kind=planner reason="plan the fix">>`',
      '\\<\\<handoff kind=planner reason="plan the fix"\\>\\>',
      '<<handoff kind="planner" reason=“plan the fix”>>',
      '&lt;&lt;handoff kind=planner reason=&quot;plan the fix&quot;&gt;&gt;',
      '<< handoff kind=planner reason="plan the fix" >>',
    ];
    for (const form of forms) {
      expect(extractHandoff(`Scouting finished.\n${form}\nmore`), form).toEqual({
        kind: 'planner',
        reason: 'plan the fix',
        planId: null,
      });
    }
  });

  it('reads a blocking question in every wrapping', () => {
    const body = 'Which route first?';
    const forms = [
      `<<ctx-question blocking="true" suggestions="a | b" recommended="a">>${body}<</ctx-question>>`,
      `\\<\\<ctx-question blocking="true" suggestions="a | b" recommended="a"\\>\\>${body}\\<\\</ctx-question\\>\\>`,
      `<< ctx-question blocking=“true” suggestions=“a | b” recommended=“a” >>${body}<</ctx-question>>`,
      `&lt;&lt;ctx-question blocking=&quot;true&quot;&gt;&gt;${body}&lt;&lt;/ctx-question&gt;&gt;`,
    ];
    for (const form of forms) {
      expect(hasBlockingQuestion({ assistantText: `Need input.\n${form}` }), form).toBe(true);
      expect(extractMarkers(form).questions[0]?.text, form).toBe(body);
    }
  });

  it('reads a plan in every wrapping', () => {
    const forms = [
      '<<plan>>Fix ledger-core\n- one\n- two<</plan>>',
      '\\<\\<plan\\>\\>Fix ledger-core\n- one\n- two\\<\\</plan\\>\\>',
      '<<PLAN>>Fix ledger-core\n- one\n- two<</PLAN>>',
    ];
    for (const form of forms) {
      expect(extractPlanFromMarker(`Here it is.\n${form}\nDone.`), form).toEqual({
        title: 'Fix ledger-core',
        bodyMd: '- one\n- two',
      });
    }
  });

  it('hides the variants from the displayed text', () => {
    const shown = stripControlMarkers(
      'Report ready.\n\n\\<\\<step-done id="agent-1"\\>\\>\n\\<\\<handoff kind=planner reason="plan"\\>\\>',
    );
    expect(shown).toBe('Report ready.');
  });
});
