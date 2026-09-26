import type { AgentId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { taskModelAgentSpawnConfig } from '../../../features/session/components/AgentSpawnConfig/taskModelAgentSpawnConfig';
import { autoLimitContext } from '../providerLimits/autoLimitContext';
import { selectMountById } from '../project-mounts/selectors';
import { scribeKeyOf } from './scribeKeyOf';
import { scribeKickoff } from './scribeKickoff';
import type { GetFn, RequestScribeInput, ScribeWork, SetFn } from './types';

export const SCRIBE_NAME = 'Scribe';

type PatchParams = {
  readonly set: SetFn;
  readonly key: string;
  readonly patch: Partial<Omit<ScribeWork, 'key'>>;
};

export const patchScribeWork = ({ set, key, patch }: PatchParams): void => {
  set((state) => {
    const current = state.scribeWork[key];
    if (current === undefined) {
      return state;
    }
    return {
      scribeWork: {
        ...state.scribeWork,
        [key]: { ...current, ...patch, updatedAt: Date.now() },
      },
    };
  });
};

const slotValue = ({
  slots,
  key,
}: {
  readonly slots: ReadonlyArray<{ readonly key: string; readonly value: string }>;
  readonly key: string;
}): string => slots.find((slot) => slot.key === key)?.value ?? '';

export const requestScribe = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId, task, hint }: RequestScribeInput): Promise<string> => {
    const key = scribeKeyOf({ mountId, kind: task.kind });
    if (get().scribeWork[key]?.status === 'writing') {
      return key;
    }
    const state = get();
    const mount = selectMountById({ state, sessionId, mountId });
    if (mount === null) {
      throw new Error('This branch is no longer in the session.');
    }
    const session = state.sessions.find((candidate) => candidate.id === sessionId) ?? null;
    const project = state.projects.find((candidate) => candidate.id === mount.projectId) ?? null;
    const overrides =
      session === null ? null : (state.workspaceOverrides?.[session.workspaceId] ?? null);
    const config = taskModelAgentSpawnConfig({
      task: 'pr_draft',
      preferences: overrides?.taskModels,
      workspaceDefaultProviderId: overrides?.defaultProviderId,
      sessionDefaultProviderId: session?.providerPreference.defaultProvider ?? 'anthropic',
      limitContext: autoLimitContext({ state }),
    });
    if (config.provider === '') {
      throw new Error('No provider is connected to write this text.');
    }
    const slots = state.sessionSlots[sessionId] ?? [];
    const kickoff = scribeKickoff({
      task,
      branch: mount.branch,
      baseBranch: mount.baseBranch ?? project?.baseBranch ?? 'main',
      goal: session?.goal ?? '',
      decisions: slotValue({ slots, key: 'decisions' }),
      summary: slotValue({ slots, key: 'last_output_summary' }),
      issues: (state.sessionExternalTasks[sessionId] ?? []).map((issue) =>
        `${issue.identifier} ${issue.title}`.trim(),
      ),
      ...(hint !== undefined && { hint }),
    });
    set((current) => ({
      scribeWork: {
        ...current.scribeWork,
        [key]: {
          key,
          sessionId,
          mountId,
          agentId: null,
          task,
          status: 'writing',
          output: null,
          error: null,
          updatedAt: Date.now(),
        },
      },
    }));
    let agentId: AgentId;
    try {
      agentId = await get().spawnAgent(sessionId, {
        mountId,
        name: SCRIBE_NAME,
        kindOverride: 'scribe',
        model: config.model,
        provider: config.provider,
        effort: config.effort,
        focus: 'none',
      });
    } catch (error) {
      patchScribeWork({ set, key, patch: { status: 'failed', error: formatError(error) } });
      throw error;
    }
    set((current) => ({ scribeAgents: { ...current.scribeAgents, [agentId]: key } }));
    patchScribeWork({ set, key, patch: { agentId } });
    void get()
      .sendTurn({
        sessionId,
        agentId,
        mountId,
        content: kickoff,
        handoff: { instruction: kickoff, plan: null },
      })
      .catch((error: unknown) => {
        patchScribeWork({ set, key, patch: { status: 'failed', error: formatError(error) } });
      });
    return key;
  };
};
