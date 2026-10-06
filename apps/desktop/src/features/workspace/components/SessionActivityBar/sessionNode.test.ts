// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionAttentionReason, SessionStage } from '@goodboy/types';
import { sessionNodeOf } from './sessionNode';

const nodeOf = (
  stage: SessionStage,
  attention: SessionAttentionReason | null = null,
  isArchived = false,
) => sessionNodeOf({ stage, attention, isArchived });

describe('the five state nodes', () => {
  it.each<[SessionAttentionReason, string]>([
    ['open-question', 'question'],
    ['fix-needs-you', 'question'],
    ['unread-reply', 'question'],
    ['pr-approved', 'question'],
    ['needs-approval', 'approval'],
    ['agent-error', 'failed'],
    ['ci-failed', 'failed'],
    ['fix-couldnt-fix', 'failed'],
    ['changes-requested', 'failed'],
  ])('draws %s as the %s node under needs you', (attention, state) => {
    expect(nodeOf('attention', attention)).toMatchObject({ kind: 'needs', state });
  });

  it('draws a failure in the danger tone and the rest in the warning tone', () => {
    expect(nodeOf('attention', 'agent-error').tone).toBe('danger');
    expect(nodeOf('attention', 'open-question').tone).toBe('warning');
  });

  it('draws a running session with the running ring', () => {
    expect(nodeOf('running')).toMatchObject({
      kind: 'running',
      state: 'running',
      label: 'Running',
    });
  });

  it('draws a finished session as the muted check', () => {
    expect(nodeOf('done')).toMatchObject({ kind: 'done', state: 'closed', label: 'Done' });
  });

  it.each<SessionStage>(['review', 'building'])('draws a %s session as an idle ring', (stage) => {
    expect(nodeOf(stage)).toMatchObject({ kind: 'idle', state: 'marker', label: 'Idle' });
  });

  it('draws an archived session as the dashed ring whatever its stage', () => {
    expect(nodeOf('running', null, true)).toMatchObject({ kind: 'archived', state: 'queued' });
    expect(nodeOf('attention', 'open-question', true).kind).toBe('archived');
  });

  it('never draws a glyph on the idle, done-ring or archived nodes beyond their own', () => {
    expect(nodeOf('building').mark).toEqual({ kind: 'glyph', glyph: null });
    expect(nodeOf('building', null, true).mark).toEqual({ kind: 'glyph', glyph: null });
  });
});
