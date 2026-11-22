// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type SessionEventId,
  type SessionId,
  type SessionProjectMount,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import type { TimelineTopLevelEntry } from '../../timeline/buildTimelineGroups';
import { activityEntryMatches, type ActivityFilter } from './activityEntryMatches';
import { workEntriesOf } from './workEntriesOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger-core' });
const LEDGER = brandId<MountId>({ value: 'mount-ledger-core' });
const RELAY = brandId<MountId>({ value: 'mount-notify-relay' });
const AT = brandId<IsoDateTime>({ value: '2026-11-20T10:00:00.000Z' });

const mountOf = ({ mountId, name }: { readonly mountId: MountId; readonly name: string }) =>
  ({
    mountId,
    sessionId: SESSION_ID,
    projectId: brandId<ProjectId>({ value: `project-${name}` }),
    mountName: name,
    worktreePath: `~/code/harborline/${name}`,
    lastWorktreePath: null,
    repoRoot: `~/code/harborline/${name}`,
    branch: 'hl/export',
    baseBranch: 'main',
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 0,
  }) satisfies SessionProjectMount;

const MOUNTS = [
  mountOf({ mountId: LEDGER, name: 'ledger-core' }),
  mountOf({ mountId: RELAY, name: 'notify-relay' }),
];

const ALL: ActivityFilter = { kind: null, mountIds: new Set() };

const agentEntry: TimelineTopLevelEntry = {
  kind: 'agent',
  id: 'agent:a1',
  at: AT,
  ordinal: 0,
  agent: anAgent({ sessionId: SESSION_ID, mountId: LEDGER }),
  agentKind: 'implementer',
  isMissingArtifact: false,
  stepLabel: null,
  openQuestions: [],
  terminalQuestions: [],
  children: [],
  answers: [],
  hasDuration: true,
  chain: null,
};

const pushEntry: TimelineTopLevelEntry = {
  kind: 'event',
  id: 'event:e1',
  at: AT,
  event: {
    id: brandId<SessionEventId>({ value: 'e1' }),
    sessionId: SESSION_ID,
    kind: 'history_pushed',
    payload: { worktreePath: '~/code/harborline/notify-relay' },
    createdAt: AT,
  },
};

const [scriptEntry] = workEntriesOf({
  events: [
    {
      id: 'w1',
      runId: 'run-w1',
      sessionId: SESSION_ID,
      mountId: RELAY,
      agentId: null,
      kind: 'script',
      startedAt: Date.parse(AT),
      endedAt: Date.parse(AT) + 1_000,
      exitCode: 1,
      payload: { name: 'test' },
    },
  ],
  mounts: MOUNTS,
});

const matches = ({
  entry,
  filter,
}: {
  readonly entry: TimelineTopLevelEntry | undefined;
  readonly filter: ActivityFilter;
}): boolean => {
  if (entry === undefined) {
    throw new Error('no entry');
  }
  return activityEntryMatches({ entry, filter, mounts: MOUNTS });
};

describe('activityEntryMatches', () => {
  it('keeps every row when no filter is set', () => {
    for (const entry of [agentEntry, pushEntry, scriptEntry]) {
      expect(matches({ entry, filter: ALL })).toBe(true);
    }
  });

  it('reads the project of a row from its mount id, or its worktree path for an event', () => {
    const relay: ActivityFilter = { kind: null, mountIds: new Set([RELAY]) };

    expect(matches({ entry: agentEntry, filter: relay })).toBe(false);
    expect(matches({ entry: pushEntry, filter: relay })).toBe(true);
    expect(matches({ entry: scriptEntry, filter: relay })).toBe(true);
  });

  it('sorts rows into agents, branch and script kinds', () => {
    expect(matches({ entry: agentEntry, filter: { ...ALL, kind: 'agents' } })).toBe(true);
    expect(matches({ entry: pushEntry, filter: { ...ALL, kind: 'branch' } })).toBe(true);
    expect(matches({ entry: scriptEntry, filter: { ...ALL, kind: 'script' } })).toBe(true);
    expect(matches({ entry: scriptEntry, filter: { ...ALL, kind: 'check' } })).toBe(false);
  });

  it('names the project of a script row from its mount', () => {
    expect(scriptEntry?.kind === 'work' ? scriptEntry.mountName : null).toBe('notify-relay');
  });
});
