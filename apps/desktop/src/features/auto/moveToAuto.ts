import { AUTO_GATES, autoTreeCapUsd, isUsableMount, type PickableMount } from '@goodboy/core';
import type { Database } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type AutoTreeId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { tauriDatabase } from '../../shared/lib/db';
import { pausingSessionCapOf } from '../budget/pausingSessionCapOf';
import { useAppStore } from '../../store';
import { writeRunGuidance } from '../../store/runtime/runGuidance/writeRunGuidance';
import { adoptAgent, type AdoptOutcome } from '../../store/runtime/auto/adoptAgent';
import { scopedKindRouting } from '../../store/slices/agents/scopedKindRouting';
import { selectResolvedSettings } from '../../store/slices/overrides/selectResolvedSettings';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { AGENT_KIND_META, classifyAgent } from '../session/agent-kind';
import { isTurnStateLive } from '../session/agent-lifecycle';
import { lastReplyOf } from '../session/lastReplyOf';
import { invokeAgentList } from '../workflows/workflows';
import { currentAutoDrivePort } from './autoDrivePort';
import { readAutoTreeLimit } from './autoTreeLimit';

const OFF_MESSAGE = 'Auto is not available in this build.';
const GONE_MESSAGE = 'This agent is no longer in the session.';
const DEFAULT_EFFORT = 'medium';
const DEFAULT_PROVIDER = 'anthropic';
const DEFAULT_MODEL = 'default';

export type MoveToAutoParams = Readonly<{
  db?: Database;
  isReleased?: boolean;
  sessionId: SessionId;
  agentId: AgentId;
  instruction: string;
  guidance?: string | null;
}>;

export type MoveToAutoResult = AdoptOutcome | Readonly<{ kind: 'off'; message: string }>;

type MountLabelParams = {
  readonly mounts: ReadonlyArray<PickableMount>;
};

const mountLabelOf = ({ mounts }: MountLabelParams): string | null => {
  const usable = mounts.filter((mount) => isUsableMount({ mount }));
  return usable.length === 0
    ? null
    : usable.map((mount) => `${mount.mountName} on ${mount.branch}`).join(', ');
};

type DriveAtOnceParams = {
  readonly treeId: AutoTreeId;
  readonly sessionId: SessionId;
};

const driveAtOnce = async ({ treeId, sessionId }: DriveAtOnceParams): Promise<void> => {
  const port = currentAutoDrivePort();
  if (port === null) {
    return;
  }
  try {
    await port({ treeId });
  } catch (error) {
    await useAppStore.getState().reportError({ title: 'Auto hit a problem', error, sessionId });
  }
};

export const moveToAuto = async ({
  db = tauriDatabase,
  isReleased = AUTO_GATES.isDelegationEnabled,
  sessionId,
  agentId,
  instruction,
  guidance = null,
}: MoveToAutoParams): Promise<MoveToAutoResult> => {
  if (!isReleased) {
    return { kind: 'off', message: OFF_MESSAGE };
  }
  const state = useAppStore.getState();
  const agent = (state.sessionPhaseRuns[sessionId] ?? []).find((entry) => entry.id === agentId);
  const session = sessionById(state.sessions, sessionId);
  if (agent === undefined || session === undefined) {
    return { kind: 'failed', message: GONE_MESSAGE };
  }
  const kind = classifyAgent({ agent, override: state.agentKindOverride[agentId] ?? null });
  const events = state.transcripts[agentId] ?? [];
  const mounts = (await state.loadSessionMounts({ sessionId })).map((view): PickableMount => ({
    id: view.id,
    mountName: view.mountName,
    branch: view.branch,
    projectId: view.projectId,
    worktreePath: view.worktreePath,
    revision: view.revision,
    isAttached: view.isAttached,
    diskState: view.diskState,
  }));
  const settings = selectResolvedSettings({ state, sessionId });
  const routing = scopedKindRouting({ state, settings, kind: 'auto' });
  const capUsd = autoTreeCapUsd({
    sessionCapUsd: pausingSessionCapOf({ budget: state.sessionBudgets[sessionId] }),
    workspaceLimitUsd: await readAutoTreeLimit({
      db,
      workspaceId: brandId<WorkspaceId>({ value: session.workspaceId }),
    }),
  });
  const outcome = await adoptAgent({
    db,
    sessionId,
    sourceAgentId: agentId,
    source: {
      kind,
      roleLabel: AGENT_KIND_META[kind].label,
      isTurnLive: isTurnStateLive({ turnState: state.agentTurnState[agentId] }),
      goal: events.find((event) => event.kind === 'user_text')?.text ?? '',
      lastReply: lastReplyOf({ events }) ?? '',
      mountLabel: mountLabelOf({ mounts }),
      provider: state.agentProviderOverride[agentId] ?? agent.providerOverride ?? DEFAULT_PROVIDER,
      model: state.agentModelOverride[agentId] ?? agent.modelOverride ?? DEFAULT_MODEL,
      effort: state.agentEffortOverride[agentId] ?? agent.effort ?? DEFAULT_EFFORT,
    },
    instruction,
    autoRouting: routing,
    primaryMountId: mounts.find((mount) => isUsableMount({ mount }))?.id ?? null,
    capUsd,
    nowMs: Date.now(),
    newId: () => crypto.randomUUID(),
  });
  if (outcome.kind === 'adopted' || outcome.kind === 'exists') {
    if (guidance !== null && guidance.trim() !== '') {
      await writeRunGuidance({
        db,
        workspaceId: brandId<WorkspaceId>({ value: session.workspaceId }),
        agentId: outcome.autoAgentId,
        text: guidance,
      });
    }
    const agents = await invokeAgentList(sessionId);
    useAppStore.setState((current) => ({
      sessionPhaseRuns: { ...current.sessionPhaseRuns, [sessionId]: agents },
    }));
    await useAppStore.getState().loadAutoTrees({ sessionId });
  }
  if (outcome.kind === 'adopted') {
    await driveAtOnce({ treeId: outcome.treeId, sessionId });
  }
  return outcome;
};
