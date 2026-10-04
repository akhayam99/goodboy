// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HANDOFF_SECTION_LABEL } from '../features/chat/utils/handoffLabels';
import { ROLE_LABEL } from '../features/session/agent-kind';
import { LENS_LABEL } from '../features/session/lens-labels';
import { SESSION_STAGE_META } from '../features/session/session-stage';
import { VERBOSITY_LABEL, verbosityDirective } from '../features/settings/verbosity';
import { RUN_AUTONOMY_HEADER } from '../features/workflows/runAutonomy';
import { RETIRED_NAMES } from '../__tests__/regressions/retiredNames';
import { NAMES } from './names';

describe('names', () => {
  it('feeds the lens, role, handoff, stage, autonomy and reply length labels', () => {
    expect(RUN_AUTONOMY_HEADER).toBe(NAMES.whenToAsk);
    expect(ROLE_LABEL).toEqual(NAMES.role);
    expect(LENS_LABEL.questions).toBe(NAMES.questions);
    expect(LENS_LABEL.agents).toBe(NAMES.agents);
    expect(LENS_LABEL.workflows).toBe(NAMES.workflows);
    expect(LENS_LABEL.review).toBe(NAMES.review);
    expect(LENS_LABEL.plans).toBe(NAMES.artifacts);
    expect(LENS_LABEL.scripts).toBe(NAMES.scripts);
    expect(LENS_LABEL.terminal).toBe(NAMES.terminal);
    expect(LENS_LABEL.context).toBe(NAMES.context);
    expect(LENS_LABEL.goal).toBe(NAMES.goal);
    expect(LENS_LABEL.decisions).toBe(NAMES.decisions);
    expect(HANDOFF_SECTION_LABEL.goal).toBe(NAMES.goal);
    expect(HANDOFF_SECTION_LABEL.plan).toBe(NAMES.plan);
    expect(HANDOFF_SECTION_LABEL.files).toBe(NAMES.files);
    expect(SESSION_STAGE_META.attention.label).toBe(NAMES.needsYou.toLowerCase());
    expect(SESSION_STAGE_META.running.label).toBe(NAMES.running.toLowerCase());
    expect(SESSION_STAGE_META.review.label).toBe(NAMES.inReview.toLowerCase());
    expect(SESSION_STAGE_META.building.label).toBe(NAMES.building.toLowerCase());
    expect(SESSION_STAGE_META.done.label).toBe(NAMES.done.toLowerCase());
    expect(VERBOSITY_LABEL).toEqual({
      brief: NAMES.short,
      normal: NAMES.normal,
      verbose: NAMES.long,
    });
  });

  it('names the reply length Short, Normal and Long', () => {
    expect(Object.values(VERBOSITY_LABEL)).toEqual(['Short', 'Normal', 'Long']);
  });

  it('sends the provider the same reply length directive as before the rename', () => {
    expect(verbosityDirective('brief')).toBe(
      'Output verbosity: BRIEF. Output only what is strictly required to answer or act. No preambles, no recaps, no explanations unless asked. Single short sentence per update; one-line end-of-turn.',
    );
    expect(verbosityDirective('normal')).toBe(
      'Output verbosity: NORMAL. Standard prose. Include rationale when non-obvious; avoid filler.',
    );
    expect(verbosityDirective('verbose')).toBe(
      'Output verbosity: VERBOSE. Include reasoning, alternatives considered, and trade-offs. Long-form is acceptable.',
    );
  });

  it('retires a name only in favour of one that exists', () => {
    const known = new Set<string>(
      Object.values(NAMES).filter((value) => typeof value === 'string'),
    );

    expect(RETIRED_NAMES.filter((retired) => !known.has(retired.use))).toEqual([]);
  });
});
