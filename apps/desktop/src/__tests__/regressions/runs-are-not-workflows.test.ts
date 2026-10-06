// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { describeCopy, scanCopy } from './scanCopy';

const RUN_CALLED_WORKFLOW: ReadonlyArray<RegExp> = [
  /\bworkflow runs?\b/i,
  /\b(?:Stop|Archive|Delete|Restore|Start) (?:this |the )?workflow\b(?! (?:draft|builder))/,
  /\bWorkflow (?:blocked|step held back|moved on)\b/i,
  /\b(?:the|this) workflow (?:moved on|has no step left)\b/i,
  /\b(?:Pause|Pauses) workflows\b/,
  /\bAgents and workflows\b/,
  /\bOpen workflows\b(?!\s+Studio)/,
];

const callsRunAWorkflow = (text: string): boolean =>
  RUN_CALLED_WORKFLOW.some((pattern) => pattern.test(text));

describe('a run is never called a workflow', () => {
  it('flags the old words and passes the new ones', () => {
    expect(callsRunAWorkflow('Stop workflow')).toBe(true);
    expect(callsRunAWorkflow('Archive this workflow')).toBe(true);
    expect(callsRunAWorkflow('Delete workflow run')).toBe(true);
    expect(callsRunAWorkflow('Workflow blocked')).toBe(true);
    expect(callsRunAWorkflow('Pauses workflows')).toBe(true);
    expect(callsRunAWorkflow('Open workflows')).toBe(true);
    expect(callsRunAWorkflow('Stop run')).toBe(false);
    expect(callsRunAWorkflow('Start a run')).toBe(false);
    expect(callsRunAWorkflow('Pauses runs')).toBe(false);
    expect(callsRunAWorkflow('Run a workflow')).toBe(false);
    expect(callsRunAWorkflow('Start workflow builder')).toBe(false);
  });

  it('keeps every visible string on the run vocabulary', () => {
    const offenders = scanCopy()
      .filter((copy) => callsRunAWorkflow(copy.text))
      .map((copy) => describeCopy({ copy }));

    expect(offenders).toEqual([]);
  });
});
