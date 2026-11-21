import type { Agent, SessionId, SessionProjectMount, TurnEvent } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import type { AppStore } from '../../../store/store';
import {
  readWorktreeStatus,
  worktreeStatusKey,
} from '../../../store/runtime/worktreeStatuses/cache';
import { changedCount, distanceAhead } from '../../../shared/lib/gitStatus';
import type { ScriptRunRecord } from '../../scripts/scripts';
import type { AskLiveCalls, AskLiveCheck, AskLiveInput, AskLiveScript } from './askLiveSection';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

const CALLS_PER_AGENT = 10;
const CALL_DETAIL_CHARS = 160;
const DETAIL_KEYS: ReadonlyArray<string> = [
  'command',
  'file_path',
  'path',
  'pattern',
  'query',
  'url',
];

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];
const EMPTY_EVENTS: ReadonlyArray<TurnEvent> = [];
const EMPTY_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

const CHECK_ROLLUP: Readonly<Record<'pending' | 'success' | 'failure', string>> = {
  pending: 'running',
  success: 'passed',
  failure: 'failed',
};

const SCRIPT_OUTCOME: Readonly<Record<ScriptRunRecord['status'], string>> = {
  idle: 'not run',
  pending: 'running',
  ok: 'passed',
  error: 'failed',
  cancelled: 'stopped',
};

type InputParams = {
  readonly input: unknown;
};

const callDetailOf = ({ input }: InputParams): string => {
  if (!isRecord(input)) {
    return '';
  }
  const value = DETAIL_KEYS.map((key) => input[key]).find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.trim() !== '',
  );
  return value === undefined ? '' : ` ${value.trim().slice(0, CALL_DETAIL_CHARS)}`;
};

type EventsParams = {
  readonly events: ReadonlyArray<TurnEvent>;
};

const lastCallsOf = ({ events }: EventsParams): ReadonlyArray<string> => {
  const failed = new Set(
    events.flatMap((event) =>
      event.kind === 'tool_call_end' && event.isError ? [event.toolUseId] : [],
    ),
  );
  return events
    .flatMap((event) => (event.kind === 'tool_call_start' ? [event] : []))
    .slice(-CALLS_PER_AGENT)
    .map((event) => {
      const outcome = failed.has(event.toolUseId) ? ' (failed)' : '';
      return `${event.toolName}${callDetailOf({ input: event.input })}${outcome}`;
    });
};

type AgentParams = {
  readonly state: AppStore;
  readonly agent: Agent;
};

const isAgentWorking = ({ state, agent }: AgentParams): boolean => {
  const turn = state.agentTurnState[agent.id]?.kind;
  return turn === 'running' || turn === 'starting' || agent.status === 'running';
};

const callsOf = ({ state, sessionId }: Params): ReadonlyArray<AskLiveCalls> =>
  (state.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS)
    .filter((agent) => agent.deletedAt == null && isAgentWorking({ state, agent }))
    .map((agent) => ({
      agent: agent.name,
      calls: lastCallsOf({ events: state.transcripts[agent.id] ?? EMPTY_EVENTS }),
    }));

const liveChecksOf = ({ state, sessionId }: Params): ReadonlyArray<AskLiveCheck> =>
  (state.sessionProjectMounts[sessionId] ?? EMPTY_MOUNTS).flatMap((mount) => {
    const github = state.mountGithub[mount.mountId];
    const pr = github?.pr ?? null;
    if (pr === null) {
      return [];
    }
    const detail = github?.detail ?? null;
    if (detail !== null && detail.prNumber === pr.number && detail.checks.length > 0) {
      return detail.checks.map((check) => ({
        project: mount.mountName,
        name: check.name,
        outcome: check.conclusion,
      }));
    }
    if (pr.checks === null) {
      return [];
    }
    return [
      { project: mount.mountName, name: `on #${pr.number}`, outcome: CHECK_ROLLUP[pr.checks] },
    ];
  });

const worktreesOf = ({ state, sessionId }: Params): ReadonlyArray<string> =>
  (state.sessionProjectMounts[sessionId] ?? EMPTY_MOUNTS).flatMap((mount) => {
    if (mount.worktreePath === null) {
      return [];
    }
    const status = readWorktreeStatus(
      worktreeStatusKey({
        worktreePath: mount.worktreePath,
        baseBranch: mount.baseBranch ?? undefined,
      }),
    );
    if (status === null) {
      return [`${mount.mountName} on ${mount.branch}: not read yet`];
    }
    const ahead = distanceAhead({ distance: status.mainDistance });
    const changed = changedCount({ workingTree: status.workingTree });
    const facts = [
      ahead === null ? null : `${ahead} commits ahead of ${mount.baseBranch ?? 'the base'}`,
      changed === null ? null : `${changed} changed files`,
      status.inProgress === null ? null : `${status.inProgress} in progress`,
    ].filter((fact): fact is string => fact !== null);
    return [`${mount.mountName} on ${mount.branch}: ${facts.join(', ')}`];
  });

type RecordParams = {
  readonly record: ScriptRunRecord;
};

const scriptOutputOf = ({ record }: RecordParams): string => {
  if (record.output !== undefined) {
    return record.output;
  }
  if (record.result === null) {
    return '';
  }
  return [record.result.stdout, record.result.stderr].filter((part) => part !== '').join('\n');
};

const scriptsOf = ({ state, sessionId }: Params): ReadonlyArray<AskLiveScript> => {
  const mounts = state.sessionProjectMounts[sessionId] ?? EMPTY_MOUNTS;
  return Object.entries(state.scriptRuns[sessionId] ?? {}).map(([key, record]) => {
    const exit = record.result === null ? '' : ` with exit code ${record.result.exitCode}`;
    return {
      project: mounts.find((mount) => mount.mountId === record.mountId)?.mountName ?? null,
      name: record.name ?? key,
      outcome: `${SCRIPT_OUTCOME[record.status]}${record.status === 'pending' ? '' : exit}`,
      output: scriptOutputOf({ record }),
    };
  });
};

export const askLiveOf = ({ state, sessionId }: Params): AskLiveInput => ({
  calls: callsOf({ state, sessionId }),
  checks: liveChecksOf({ state, sessionId }),
  worktrees: worktreesOf({ state, sessionId }),
  scripts: scriptsOf({ state, sessionId }),
});
