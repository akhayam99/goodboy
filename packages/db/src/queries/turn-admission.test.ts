import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { brandId, type AgentId, type ProviderRunId } from '@goodboy/types';
import type { Database } from '../client';
import { liveTestRuns, makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  TURN_ADMISSION_HOLD_MS,
  isTurnAdmissionHeld,
  releaseTurnAdmission,
  stopGhostAgent,
  stopGhostAgents,
} from './turn-admission';

const SESSION_ID = 'session-ledger';
const NOW_MS = 1_800_000_000_000;
const LAUNCH = 'launch-now';

type ClaimParams = {
  readonly agentId: string;
  readonly runId: string;
  readonly launch: string | null;
  readonly ageMs: number;
};

describe('turn admissions', () => {
  let db: Database;

  beforeEach(async () => {
    db = await makeMigratedTestDatabase();
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('w1', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, 'w1', 'Reconcile the ledger', 'idle', 1, 1)",
      [SESSION_ID],
    );
  });

  const seedRunning = async (id: string, runId: string | null, status = 'running') => {
    await db.execute(
      "INSERT INTO agents (id, session_id, ordinal, name, status, provider_run_id) VALUES (?, ?, 0, 'implementer', ?, ?)",
      [id, SESSION_ID, status, runId],
    );
  };

  const claim = async ({ agentId, runId, launch, ageMs }: ClaimParams): Promise<void> => {
    const claimedAt = NOW_MS - ageMs;
    await db.execute(
      `INSERT INTO turn_admissions
         (id, agent_id, run_id, owner_launch, claimed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [agentId, agentId, runId, launch, claimedAt, claimedAt, claimedAt],
    );
  };

  const statusOf = async (id: string): Promise<string | undefined> =>
    (await db.select<{ status: string }>('SELECT status FROM agents WHERE id = ?', [id]))[0]
      ?.status;

  const admittedRuns = async (): Promise<ReadonlyArray<string>> =>
    (await db.select<{ run_id: string }>('SELECT run_id FROM turn_admissions ORDER BY run_id')).map(
      (row) => row.run_id,
    );

  const agent = (id: string): AgentId => brandId<AgentId>({ value: id });
  const run = (id: string): ProviderRunId => brandId<ProviderRunId>({ value: id });

  describe('stopGhostAgents', () => {
    it('stops the running rows whose run is not kept and leaves the others', async () => {
      await seedRunning('ghost', 'run-ghost');
      await seedRunning('live', 'run-live');
      await seedRunning('unassigned', null);
      await seedRunning('done', 'run-done', 'completed');

      const stopped = await stopGhostAgents({
        db,
        keepRunIds: ['run-live'],
        launchId: LAUNCH,
        nowMs: NOW_MS,
      });

      expect(stopped).toBe(1);
      expect(await statusOf('ghost')).toBe('stopped');
      expect(await statusOf('live')).toBe('running');
      expect(await statusOf('unassigned')).toBe('running');
      expect(await statusOf('done')).toBe('completed');
    });

    it('records who stopped the row and when', async () => {
      await seedRunning('ghost', 'run-ghost');

      await stopGhostAgents({ db, keepRunIds: [], launchId: LAUNCH, nowMs: NOW_MS });

      const [row] = await db.select<{ stopped_by: string; stopped_at: number }>(
        "SELECT stopped_by, stopped_at FROM agents WHERE id = 'ghost'",
      );
      expect(row?.stopped_by).toBe('app');
      expect(row?.stopped_at).toBe(NOW_MS);
    });

    it('keeps a run whose permission ask has no decision, and stops one that was decided', async () => {
      await seedRunning('asking', 'run-asking');
      await seedRunning('answered', 'run-answered');
      type EventParams = {
        readonly id: string;
        readonly agentId: string;
        readonly payload: object;
      };
      const event = async ({ id, agentId, payload }: EventParams): Promise<void> => {
        await db.execute(
          `INSERT INTO turn_events (id, session_id, agent_id, payload, created_at)
           VALUES (?, ?, ?, ?, 1)`,
          [id, SESSION_ID, agentId, JSON.stringify(payload)],
        );
      };
      const ask = { kind: 'permission_request', toolName: 'Bash', input: {}, at: '' };
      await event({
        id: 'ask-1',
        agentId: 'asking',
        payload: { ...ask, runId: 'run-asking', toolUseId: 'tool-1' },
      });
      await event({
        id: 'ask-2',
        agentId: 'answered',
        payload: { ...ask, runId: 'run-answered', toolUseId: 'tool-2' },
      });
      await event({
        id: 'decision-2',
        agentId: 'answered',
        payload: {
          kind: 'permission_decision',
          runId: 'run-answered',
          toolUseId: 'tool-2',
          decision: 'deny',
          ruleId: null,
          decidedBy: 'user',
          at: '',
        },
      });

      expect(await stopGhostAgents({ db, keepRunIds: [], launchId: LAUNCH, nowMs: NOW_MS })).toBe(
        1,
      );
      expect(await statusOf('asking')).toBe('running');
      expect(await statusOf('answered')).toBe('stopped');
    });

    it('is a no-op the second time', async () => {
      await seedRunning('ghost', 'run-ghost');
      await stopGhostAgents({ db, keepRunIds: [], launchId: LAUNCH, nowMs: NOW_MS });

      expect(await stopGhostAgents({ db, keepRunIds: [], launchId: LAUNCH, nowMs: NOW_MS })).toBe(
        0,
      );
    });

    it('keeps a claim of this launch that has not spawned yet', async () => {
      await seedRunning('claimed', 'run-claimed');
      await claim({ agentId: 'claimed', runId: 'run-claimed', launch: LAUNCH, ageMs: 1_000 });

      expect(await stopGhostAgents({ db, keepRunIds: [], launchId: LAUNCH, nowMs: NOW_MS })).toBe(
        0,
      );
      expect(await statusOf('claimed')).toBe('running');
      expect(await admittedRuns()).toEqual(['run-claimed']);
    });

    it('stops and clears a claim left by an earlier launch at once', async () => {
      await seedRunning('crashed', 'run-crashed');
      await claim({ agentId: 'crashed', runId: 'run-crashed', launch: 'launch-old', ageMs: 1_000 });

      expect(await stopGhostAgents({ db, keepRunIds: [], launchId: LAUNCH, nowMs: NOW_MS })).toBe(
        1,
      );
      expect(await statusOf('crashed')).toBe('stopped');
      expect(await admittedRuns()).toEqual([]);
    });

    it('stops and clears a claim of this launch once it is older than the hold', async () => {
      await seedRunning('stale', 'run-stale');
      await claim({
        agentId: 'stale',
        runId: 'run-stale',
        launch: LAUNCH,
        ageMs: TURN_ADMISSION_HOLD_MS,
      });

      expect(await stopGhostAgents({ db, keepRunIds: [], launchId: LAUNCH, nowMs: NOW_MS })).toBe(
        1,
      );
      expect(await admittedRuns()).toEqual([]);
    });

    it('holds a claim by its age alone when the launch cannot be read', async () => {
      await seedRunning('claimed', 'run-claimed');
      await claim({ agentId: 'claimed', runId: 'run-claimed', launch: 'launch-old', ageMs: 1_000 });

      expect(await stopGhostAgents({ db, keepRunIds: [], launchId: null, nowMs: NOW_MS })).toBe(0);
      expect(await statusOf('claimed')).toBe('running');
    });
  });

  describe('stopGhostAgent', () => {
    it('leaves an agent whose claim is held and stops it once the claim expired', async () => {
      await seedRunning('claimed', 'run-claimed');
      await claim({ agentId: 'claimed', runId: 'run-claimed', launch: LAUNCH, ageMs: 1_000 });
      const params = {
        db,
        agentId: agent('claimed'),
        runId: run('run-claimed'),
        launchId: LAUNCH,
        hasCancelledRun: false,
      };

      expect(await isTurnAdmissionHeld({ ...params, nowMs: NOW_MS })).toBe(true);
      expect(await stopGhostAgent({ ...params, nowMs: NOW_MS })).toBe(false);
      expect(await statusOf('claimed')).toBe('running');

      const later = NOW_MS + TURN_ADMISSION_HOLD_MS;
      expect(await isTurnAdmissionHeld({ ...params, nowMs: later })).toBe(false);
      expect(await stopGhostAgent({ ...params, nowMs: later })).toBe(true);
      expect(await statusOf('claimed')).toBe('stopped');
      expect(await admittedRuns()).toEqual([]);
    });

    it('leaves a row that a newer claim moved to another run', async () => {
      await seedRunning('claimed', 'run-new');

      expect(
        await stopGhostAgent({
          db,
          agentId: agent('claimed'),
          runId: run('run-old'),
          launchId: LAUNCH,
          nowMs: NOW_MS,
          hasCancelledRun: false,
        }),
      ).toBe(false);
      expect(await statusOf('claimed')).toBe('running');
    });
  });

  describe('a cleanup acting on an older live-run snapshot', () => {
    afterEach(() => {
      liveTestRuns.clear();
    });

    it('leaves a run that spawned and released its claim after the snapshot', async () => {
      await seedRunning('spawned', 'run-spawned');
      liveTestRuns.add('run-spawned');
      const params = {
        db,
        agentId: agent('spawned'),
        runId: run('run-spawned'),
        launchId: LAUNCH,
        nowMs: NOW_MS,
      };

      expect(await stopGhostAgents({ db, keepRunIds: [], launchId: LAUNCH, nowMs: NOW_MS })).toBe(
        0,
      );
      expect(await stopGhostAgent({ ...params, hasCancelledRun: false })).toBe(false);
      expect(await statusOf('spawned')).toBe('running');

      expect(await stopGhostAgent({ ...params, hasCancelledRun: true })).toBe(true);
      expect(await statusOf('spawned')).toBe('stopped');
    });
  });

  describe('a spawn published at the hold boundary', () => {
    const publishSpawn = async (agentId: string): Promise<void> => {
      await db.execute('UPDATE turn_admissions SET spawned_at = ? WHERE agent_id = ?', [
        NOW_MS,
        agentId,
      ]);
    };

    it('keeps the agent running while the claim alone has expired', async () => {
      await seedRunning('claimed', 'run-claimed');
      await claim({
        agentId: 'claimed',
        runId: 'run-claimed',
        launch: LAUNCH,
        ageMs: TURN_ADMISSION_HOLD_MS,
      });
      await publishSpawn('claimed');
      const params = {
        db,
        agentId: agent('claimed'),
        runId: run('run-claimed'),
        launchId: LAUNCH,
        hasCancelledRun: false,
      };

      expect(await isTurnAdmissionHeld({ ...params, nowMs: NOW_MS })).toBe(true);
      expect(await stopGhostAgent({ ...params, nowMs: NOW_MS })).toBe(false);
      expect(await stopGhostAgents({ db, keepRunIds: [], launchId: LAUNCH, nowMs: NOW_MS })).toBe(
        0,
      );
      expect(await statusOf('claimed')).toBe('running');
      expect(await admittedRuns()).toEqual(['run-claimed']);
    });
  });

  it('releases only the admission of its own run', async () => {
    await seedRunning('claimed', 'run-claimed');
    await claim({ agentId: 'claimed', runId: 'run-claimed', launch: LAUNCH, ageMs: 0 });

    await releaseTurnAdmission({ db, agentId: agent('claimed'), runId: run('run-other') });
    expect(await admittedRuns()).toEqual(['run-claimed']);

    await releaseTurnAdmission({ db, agentId: agent('claimed'), runId: run('run-claimed') });
    expect(await admittedRuns()).toEqual([]);
  });
});
