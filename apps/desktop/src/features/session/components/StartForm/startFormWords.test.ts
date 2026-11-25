import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type Workflow,
  type WorkflowId,
  type WorkspaceId,
} from '@goodboy/types';
import { startFormKindOfDraft } from './startFormKinds';
import { startFormNoteOf, startReasonOf } from './startFormWords';
import { startSettingWordsOf } from './startSettingWordsOf';

const WORKFLOW_ID = brandId<WorkflowId>({ value: 'wf-launcher' });

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: brandId<WorkspaceId>({ value: 'ws-launcher' }),
  name: 'Fix a bug',
  description: 'A bug with a way to reproduce it.',
  steps: [],
  isPreset: true,
  origin: 'custom',
  createdAt: brandId<IsoDateTime>({ value: '2026-11-01T00:00:00.000Z' }),
  updatedAt: brandId<IsoDateTime>({ value: '2026-11-01T00:00:00.000Z' }),
};

const wordsOf = ({ limitMode }: { readonly limitMode: 'pause' | 'notify' }) =>
  startSettingWordsOf({
    autonomy: 'plan',
    editsMode: 'default',
    limitUsd: 20,
    limitMode,
    replies: 'Normal',
    hasOwnGuidance: false,
    projectNames: null,
  });

describe('the launcher words', () => {
  it('reads the limit mode and the reply length from Every run', () => {
    expect(wordsOf({ limitMode: 'pause' }).limit).toEqual({
      lead: 'Limit',
      value: '$20.00, then pause',
    });
    expect(wordsOf({ limitMode: 'notify' }).limit?.value).toBe('$20.00, warn only');
    expect(wordsOf({ limitMode: 'pause' }).replies).toEqual({ lead: 'Replies', value: 'normal' });
  });

  it('names the first check of the picked workflow in the one hint', () => {
    const withCheck: Workflow = { ...WORKFLOW, entryCheck: 'Reproduce the failure first.' };

    expect(startFormNoteOf({ kind: 'preset', workflow: withCheck, closeness: 'adapt' })).toBe(
      'Fix a bug checks first: reproduce the failure first.',
    );
    expect(startFormNoteOf({ kind: 'preset', workflow: WORKFLOW, closeness: 'adapt' })).toBe(
      'The Lead starts from Fix a bug and says why when it changes a step.',
    );
  });

  it('gives one reason when Start is off', () => {
    expect(startReasonOf({ hasGoal: false })).toBe('Write the goal first.');
    expect(startReasonOf({ hasGoal: true })).toBeNull();
  });

  it('reads a workflow shape with no workflow as Auto', () => {
    const base = { startKind: 'workflow', startShape: 'preset' } as const;

    expect(startFormKindOfDraft({ ...base, workflowId: null })).toBeNull();
    expect(startFormKindOfDraft({ ...base, workflowId: WORKFLOW_ID })).toBe('preset');
  });
});
