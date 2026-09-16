import { describe, expect, it } from 'vitest';
import type { WorkflowRunId } from '@goodboy/types';
import type { ArtifactBasedOn } from '../../store/slices/artifactDrafts/types';
import { artifactCreationGate, type ArtifactCreationGateParams } from './artifactCreationGate';

const SESSION_SCOPE: ArtifactBasedOn = { kind: 'session' };
const RUN_SCOPE: ArtifactBasedOn = {
  kind: 'workflow-run',
  workflowRunId: 'run-harborline-1' as WorkflowRunId,
};

const params = (
  overrides: Partial<ArtifactCreationGateParams> = {},
): ArtifactCreationGateParams => ({
  kind: 'report',
  ctaState: { kind: 'ready' },
  basedOn: SESSION_SCOPE,
  hasBrief: false,
  isBriefOverLimit: false,
  hasUsableProvider: true,
  isStarting: false,
  isCollecting: false,
  ...overrides,
});

describe('artifactCreationGate', () => {
  it('lets a wireframe brief defeat the no evidence block', () => {
    const gate = artifactCreationGate(
      params({
        kind: 'wireframe',
        hasBrief: true,
        ctaState: { kind: 'blocked', reason: 'no-evidence' },
      }),
    );
    expect(gate.isDisabled).toBe(false);
    expect(gate.tone).toBe('note');
    expect(gate.reason).toContain('comes from your brief alone');
  });

  it('never lets a brief defeat the no evidence block for a report', () => {
    const gate = artifactCreationGate(
      params({ hasBrief: true, ctaState: { kind: 'blocked', reason: 'no-evidence' } }),
    );
    expect(gate.isDisabled).toBe(true);
    expect(gate.reason).toContain('run an agent or a workflow first');
  });

  it('names the run when the picked run has no finished work', () => {
    const gate = artifactCreationGate(
      params({ basedOn: RUN_SCOPE, ctaState: { kind: 'blocked', reason: 'no-evidence' } }),
    );
    expect(gate.reason).toContain('base it on the session, or wait for the run');
  });

  it('refuses a wireframe with no brief when nothing has run', () => {
    const gate = artifactCreationGate(
      params({ kind: 'wireframe', ctaState: { kind: 'blocked', reason: 'no-evidence' } }),
    );
    expect(gate.isDisabled).toBe(true);
    expect(gate.reason).toContain('describe the screen or flow');
  });

  it('orders run active before every other reason', () => {
    const gate = artifactCreationGate(
      params({
        ctaState: { kind: 'blocked', reason: 'run-active' },
        isBriefOverLimit: true,
        hasUsableProvider: false,
      }),
    );
    expect(gate.reason).toBe('the run is still going, finish it first');
  });

  it('blocks a restored brief that is over the bound', () => {
    const gate = artifactCreationGate(params({ isBriefOverLimit: true }));
    expect(gate.isDisabled).toBe(true);
    expect(gate.reason).toBe('shorten the brief to 2,000 characters');
  });

  it('notes that collection is still running without blocking', () => {
    const gate = artifactCreationGate(params({ isCollecting: true }));
    expect(gate.isDisabled).toBe(false);
    expect(gate.reason).toContain('Generate collects again anyway');
  });
});
