import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';

const { listOpenQuestionsSpy } = vi.hoisted(() => ({
  listOpenQuestionsSpy: vi.fn(async () => [] as ReadonlyArray<OpenQuestion>),
}));

vi.mock('@goodboy/db', () => ({ listOpenQuestionsForSession: listOpenQuestionsSpy }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { findWorkflowActivationBlock } from './workflowActivationGate';

const SESSION_ID = 'ses-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const OTHER_RUN_ID = 'run-2' as WorkflowRunId;
const NOW = '2026-08-05T00:00:00.000Z' as IsoDateTime;

const question = (id: string, workflowRunId?: WorkflowRunId): OpenQuestion => ({
  id: id as OpenQuestionId,
  sessionId: SESSION_ID,
  text: id,
  suggestedAnswers: [],
  userAnswer: null,
  status: 'open',
  createdAt: NOW,
  ...(workflowRunId != null && { workflowRunId }),
});

beforeEach(() => {
  listOpenQuestionsSpy.mockReset();
  listOpenQuestionsSpy.mockResolvedValue([]);
});

describe('findWorkflowActivationBlock', () => {
  it('holds the run back when the question belongs to that run', async () => {
    listOpenQuestionsSpy.mockResolvedValue([question('q1', RUN_ID)]);

    await expect(
      findWorkflowActivationBlock({ sessionId: SESSION_ID, workflowRunId: RUN_ID }),
    ).resolves.toBe('questions');
  });

  it('lets the run start when a free agent left an orphan question in the session', async () => {
    listOpenQuestionsSpy.mockResolvedValue([question('q1')]);

    await expect(
      findWorkflowActivationBlock({ sessionId: SESSION_ID, workflowRunId: RUN_ID }),
    ).resolves.toBeNull();
  });

  it('lets the run start when the question belongs to another run', async () => {
    listOpenQuestionsSpy.mockResolvedValue([question('q1', OTHER_RUN_ID)]);

    await expect(
      findWorkflowActivationBlock({ sessionId: SESSION_ID, workflowRunId: RUN_ID }),
    ).resolves.toBeNull();
  });

  it('skips the query for an agent outside any run', async () => {
    await expect(
      findWorkflowActivationBlock({ sessionId: SESSION_ID, workflowRunId: undefined }),
    ).resolves.toBeNull();
    expect(listOpenQuestionsSpy).not.toHaveBeenCalled();
  });
});
