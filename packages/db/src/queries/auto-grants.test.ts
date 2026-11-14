import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type AutoAttemptId,
  type AutoBatchId,
  type AutoDelegationId,
  type AutoRequestId,
  type AutoTreeId,
} from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_NOW, seedAutoSession, seedAutoTree } from '../test-helpers/auto-seeds';
import { insertAutoAttemptStatement } from './auto-attempts';
import { insertAutoDelegationStatement } from './auto-delegations';
import {
  answerAutoGrantStatement,
  getAutoGrant,
  insertAutoGrantStatement,
  listAutoGrantAllowances,
  listAutoGrantsOfTree,
  markAutoGrantUsedStatement,
  type AutoGrantId,
  type AutoGrantKind,
} from './auto-grants';

const treeId = brandId<AutoTreeId>({ value: 'tree-1' });
const delegationId = brandId<AutoDelegationId>({ value: 'delegation-tester' });
const firstAttemptId = brandId<AutoAttemptId>({ value: 'attempt-tester-1' });
const secondAttemptId = brandId<AutoAttemptId>({ value: 'attempt-tester-2' });

type AttemptParams = {
  readonly db: Database;
  readonly id: AutoAttemptId;
  readonly generation?: number;
};

const addAttempt = async ({ db, id, generation = 1 }: AttemptParams): Promise<void> => {
  await db.transaction({
    statements: [
      insertAutoAttemptStatement({
        id,
        delegationId,
        treeId,
        generation,
        baseline: null,
        writeSet: null,
        nowMs: AUTO_SEED_NOW,
      }),
    ],
  });
};

const world = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db, agentIds: ['agent-tester'] });
  await seedAutoTree({ db });
  await db.transaction({
    statements: [
      insertAutoDelegationStatement({
        delegation: {
          id: delegationId,
          treeId,
          generation: 1,
          requestId: brandId<AutoRequestId>({ value: 'request-1' }),
          requestHash: 'hash-1',
          batchId: brandId<AutoBatchId>({ value: 'batch-1' }),
          slot: 0,
          childAgentId: brandId<AgentId>({ value: 'agent-tester' }),
          firstAttemptId,
          role: 'tester',
          request: { task: 'cover the payments-api retries' },
          target: { mountId: 'mount-ledger-core' },
          routing: { provider: 'anthropic', model: 'sonnet' },
          state: 'accepted',
          retryOf: null,
          reviseOf: null,
          baseRevision: null,
          isAdopted: false,
          deadlineAt: AUTO_SEED_NOW + 1_800_000,
          nowMs: AUTO_SEED_NOW,
        },
      }),
    ],
  });
  await addAttempt({ db, id: firstAttemptId });
  return db;
};

type AskParams = {
  readonly db: Database;
  readonly id: string;
  readonly kind?: AutoGrantKind;
  readonly subject?: string;
  readonly attemptId?: AutoAttemptId;
  readonly textVersion?: string;
};

const ask = async ({
  db,
  id,
  kind = 'dependency',
  subject = 'nock@14.0.1',
  attemptId = firstAttemptId,
  textVersion,
}: AskParams): Promise<AutoGrantId> => {
  const grantId = brandId<AutoGrantId>({ value: id });
  const isText = kind === 'pull_request';
  await db.transaction({
    statements: [
      insertAutoGrantStatement({
        grant: {
          id: grantId,
          treeId,
          delegationId: isText ? null : delegationId,
          attemptId: isText ? null : attemptId,
          textVersion: isText ? (textVersion ?? 'text-1') : null,
          kind,
          subject,
          nowMs: AUTO_SEED_NOW,
        },
      }),
    ],
  });
  return grantId;
};

type AnswerParams = {
  readonly db: Database;
  readonly grantId: AutoGrantId;
  readonly answer?: 'allowed' | 'declined';
};

const answer = ({ db, grantId, answer: value = 'allowed' }: AnswerParams) =>
  db.transaction({
    statements: [
      answerAutoGrantStatement({
        grantId,
        answer: value,
        nowMs: AUTO_SEED_NOW + 1_000,
        abortCode: 'grant_settled',
      }),
    ],
  });

describe('auto grants', () => {
  it('keeps one ask per attempt and subject, however many times the agent asks', async () => {
    const db = await world();
    await ask({ db, id: 'grant-1' });
    await ask({ db, id: 'grant-2' });
    await ask({ db, id: 'grant-3', kind: 'protected_file', subject: '.github/workflows/ci.yml' });
    const grants = await listAutoGrantsOfTree({ db, treeId });
    expect(grants.map((grant) => [grant.id, grant.kind, grant.state, grant.isCurrent])).toEqual([
      ['grant-1', 'dependency', 'asked', true],
      ['grant-3', 'protected_file', 'asked', true],
    ]);
  });

  it('settles an answer once and drops the second', async () => {
    const db = await world();
    const grantId = await ask({ db, id: 'grant-1' });
    expect((await answer({ db, grantId })).status).toBe('committed');
    expect(await answer({ db, grantId, answer: 'declined' })).toMatchObject({
      status: 'aborted',
      abortCode: 'grant_settled',
    });
    expect(await getAutoGrant({ db, grantId })).toMatchObject({
      state: 'allowed',
      answeredAt: AUTO_SEED_NOW + 1_000,
    });
  });

  it('drops an answer for an attempt a newer attempt replaced', async () => {
    const db = await world();
    const grantId = await ask({ db, id: 'grant-1' });
    await addAttempt({ db, id: secondAttemptId });
    expect(await getAutoGrant({ db, grantId })).toMatchObject({ isCurrent: false });
    expect((await answer({ db, grantId })).status).toBe('aborted');
    expect(await getAutoGrant({ db, grantId })).toMatchObject({ state: 'asked' });
  });

  it('drops an answer for an attempt of an older generation', async () => {
    const db = await world();
    const grantId = await ask({ db, id: 'grant-1' });
    await db.execute('UPDATE auto_trees SET generation = 2 WHERE id = ?', [treeId]);
    expect((await answer({ db, grantId })).status).toBe('aborted');
  });

  it('drops an answer for an older text and takes one for the newer text', async () => {
    const db = await world();
    const older = await ask({ db, id: 'grant-pr-1', kind: 'pull_request', subject: 'branch-1' });
    const newer = await ask({
      db,
      id: 'grant-pr-2',
      kind: 'pull_request',
      subject: 'branch-1',
      textVersion: 'text-2',
    });
    expect((await answer({ db, grantId: older })).status).toBe('aborted');
    expect((await answer({ db, grantId: newer })).status).toBe('committed');
  });

  it('lists an allowance until a launch uses it, once', async () => {
    const db = await world();
    const grantId = await ask({ db, id: 'grant-1' });
    await answer({ db, grantId });
    expect((await listAutoGrantAllowances({ db, delegationId })).map((grant) => grant.id)).toEqual([
      grantId,
    ]);
    const use = () =>
      db.transaction({
        statements: [
          markAutoGrantUsedStatement({ grantId, nowMs: AUTO_SEED_NOW + 2_000, abortCode: 'used' }),
        ],
      });
    expect((await use()).status).toBe('committed');
    expect((await use()).status).toBe('aborted');
    expect(await listAutoGrantAllowances({ db, delegationId })).toEqual([]);
    expect(await getAutoGrant({ db, grantId })).toMatchObject({ state: 'used' });
  });

  it('leaves a declined ask out of the allowances', async () => {
    const db = await world();
    const grantId = await ask({ db, id: 'grant-1' });
    await answer({ db, grantId, answer: 'declined' });
    expect(await listAutoGrantAllowances({ db, delegationId })).toEqual([]);
  });
});
