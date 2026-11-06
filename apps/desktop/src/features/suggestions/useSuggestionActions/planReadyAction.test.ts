// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId } from '@goodboy/types';
import type { AgentId, ArtifactComment, IsoDateTime, PlanId, SessionId } from '@goodboy/types';
import type { RunPlanResult } from '../../../store/slices/plans/types';
import { DRAFT_RUN_WORDS } from '../../plans/planComments/DRAFT_RUN_WORDS';
import type { HeldDraft } from '../../plans/planComments/heldDraft';
import { heldDraftStore } from '../../plans/planComments/heldDraftStore';
import { trackDraftSave } from '../../plans/planComments/trackDraftSave';
import { planReadyAction } from './planReadyAction';

const SESSION = brandId<SessionId>({ value: 'session-payments' });
const PLAN = brandId<PlanId>({ value: 'plan-export' });
const AT = brandId<IsoDateTime>({ value: '2026-10-05T10:00:00.000Z' });

const STARTED: RunPlanResult = {
  kind: 'started',
  agentId: brandId<AgentId>({ value: 'agent-impl' }),
  scope: 'workflow',
};

const written: HeldDraft = {
  sessionId: SESSION,
  artifactId: PLAN,
  revision: 1,
  anchor: { kind: 'part', index: 0, title: 'Add the idempotency key' },
  body: 'Name the index',
};

const draft: ArtifactComment = {
  id: 'comment-written',
  sessionId: SESSION,
  artifactId: PLAN,
  revision: 1,
  anchor: written.anchor,
  body: written.body,
  status: 'draft',
  sentTurnId: null,
  createdAt: AT,
  updatedAt: AT,
};

const setup = ({ comments }: { readonly comments: ReadonlyArray<ArtifactComment> }) => {
  const live = { comments };
  const runPlan = vi.fn(async () => STARTED);
  const announcePlanRun = vi.fn();
  const showToast = vi.fn();
  const action = planReadyAction({
    sessionId: SESSION,
    planId: PLAN,
    comments,
    readComments: () => live.comments,
    runPlan,
    announcePlanRun,
    showToast,
  });
  return { action, live, runPlan, announcePlanRun, showToast };
};

afterEach(() => heldDraftStore.clear());

describe('planReadyAction', () => {
  it('starts the implementer and announces it when no comment waits', async () => {
    const { action, runPlan, announcePlanRun } = setup({ comments: [] });

    await action.run();

    expect(runPlan).toHaveBeenCalledWith(SESSION, PLAN);
    expect(announcePlanRun).toHaveBeenCalledWith({ result: STARTED, sessionId: SESSION });
    expect(action.requiresConfirm).toBeUndefined();
  });

  it('asks first while a comment on the plan is unsent', () => {
    const { action } = setup({ comments: [draft] });

    expect(action.requiresConfirm).toBe(true);
    expect(action.confirm?.title).toBe('Run without your comment?');
  });

  it('waits for the first save and does not start when it made a new draft', async () => {
    const { action, live, runPlan, showToast } = setup({ comments: [] });
    trackDraftSave({
      save: new Promise<void>((resolve) => {
        live.comments = [draft];
        resolve();
      }),
      draft: written,
    });

    await action.run();

    expect(runPlan).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: DRAFT_RUN_WORDS.changed }),
    );
  });

  it('does not start while a comment that could not be saved is held', async () => {
    const { action, runPlan, showToast } = setup({ comments: [] });
    heldDraftStore.hold({ draft: written });

    await action.run();

    expect(runPlan).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: DRAFT_RUN_WORDS.held }),
    );
  });

  it('starts after the save when the ask already counted the comment', async () => {
    const { action, runPlan } = setup({ comments: [draft] });
    trackDraftSave({ save: Promise.resolve(), draft: written });

    await action.run();

    expect(runPlan).toHaveBeenCalledWith(SESSION, PLAN);
  });
});
