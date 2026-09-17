import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import {
  clampWireframeScoutReport,
  collectWireframeScoutReports,
  wireframeScoutSectionEntry,
  WIREFRAME_SCOUT_DEADLINE_REASON,
  WIREFRAME_SCOUT_DEMOTION_REASON,
  WIREFRAME_SCOUT_LIMITS,
} from './wireframeScoutReports';
import { WIREFRAME_SCOUTS } from './wireframeScoutRoles';

const SESSION_ID = 'session-1' as SessionId;
const AT = '2026-09-15T10:00:00.000Z' as IsoDateTime;

const child = ({
  name,
  status,
  outputSummary,
}: {
  readonly name: string;
  readonly status: Agent['status'];
  readonly outputSummary?: string;
}): Agent =>
  ({
    id: `agent-${name}` as AgentId,
    sessionId: SESSION_ID,
    ordinal: 1,
    name,
    kind: 'scout',
    status,
    ...(outputSummary !== undefined && { outputSummary }),
    createdAt: AT,
  }) as Agent;

const [screens, data] = WIREFRAME_SCOUTS;

describe('clampWireframeScoutReport', () => {
  it('leaves a report that fits alone', () => {
    expect(clampWireframeScoutReport({ text: '  a claim a/b.ts  ' })).toBe('a claim a/b.ts');
  });

  it('clamps a long report deterministically and says so', () => {
    const clamped = clampWireframeScoutReport({ text: 'x'.repeat(9_000) });
    expect(clamped.startsWith('x'.repeat(WIREFRAME_SCOUT_LIMITS.reportText))).toBe(true);
    expect(clamped).toContain('clamped to fit the pack');
  });
});

describe('collectWireframeScoutReports', () => {
  it('reads a finished scout as reported', () => {
    const reports = collectWireframeScoutReports({
      scouts: [screens!],
      children: [
        child({ name: screens!.name, status: 'completed', outputSummary: 'a claim a/b.ts' }),
      ],
    });
    expect(reports[0]?.state).toBe('reported');
    expect(reports[0]?.text).toBe('a claim a/b.ts');
  });

  it('reads a finished scout with nothing written as empty', () => {
    const reports = collectWireframeScoutReports({
      scouts: [screens!],
      children: [child({ name: screens!.name, status: 'completed', outputSummary: '   ' })],
    });
    expect(reports[0]?.state).toBe('empty');
    expect(reports[0]?.reason).toContain('without writing anything');
  });

  it('reads a failed scout as failed', () => {
    const reports = collectWireframeScoutReports({
      scouts: [screens!],
      children: [child({ name: screens!.name, status: 'failed' })],
    });
    expect(reports[0]?.state).toBe('failed');
  });

  it('reads a skipped scout as timed out and keeps the honest reason', () => {
    const reports = collectWireframeScoutReports({
      scouts: [screens!],
      children: [
        child({
          name: screens!.name,
          status: 'skipped',
          outputSummary: WIREFRAME_SCOUT_DEADLINE_REASON,
        }),
      ],
    });
    expect(reports[0]?.state).toBe('timed-out');
    expect(reports[0]?.reason).toBe(WIREFRAME_SCOUT_DEADLINE_REASON);
  });

  it('reads a scout that was never started as failed', () => {
    const reports = collectWireframeScoutReports({ scouts: [screens!], children: [] });
    expect(reports[0]?.state).toBe('failed');
    expect(reports[0]?.reason).toContain('never started');
  });
});

describe('wireframeScoutSectionEntry', () => {
  const reported = {
    scout: screens!,
    agentId: 'agent-1' as AgentId,
    state: 'reported' as const,
    text: 'a claim a/b.ts',
    reason: null,
  };

  it('keeps the report whole and puts the verification header on it', () => {
    const entry = wireframeScoutSectionEntry({
      report: reported,
      verification: { cited: 2, verified: ['a/b.ts'], missing: [], unverified: ['a/c.ts'] },
    });
    expect(entry.header).toBe('verified 1 of 2 cited paths');
    expect(entry.body).toBe('a claim a/b.ts');
  });

  it('demotes a report whose cited paths mostly could not be found', () => {
    const entry = wireframeScoutSectionEntry({
      report: reported,
      verification: {
        cited: 5,
        verified: ['a/b.ts'],
        missing: ['a/c.ts', 'a/d.ts', 'a/e.ts', 'a/f.ts'],
        unverified: [],
      },
    });
    expect(entry.body).toBeNull();
    expect(entry.note).toBe(WIREFRAME_SCOUT_DEMOTION_REASON);
  });

  it('keeps a report sitting exactly at the threshold', () => {
    const entry = wireframeScoutSectionEntry({
      report: reported,
      verification: {
        cited: 4,
        verified: ['a/b.ts', 'a/c.ts'],
        missing: ['a/d.ts', 'a/e.ts'],
        unverified: [],
      },
    });
    expect(entry.body).toBe('a claim a/b.ts');
  });
});
