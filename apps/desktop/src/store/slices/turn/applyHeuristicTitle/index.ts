import { invoke } from '@tauri-apps/api/core';
import { getDefaultBinary, resolveTaskModel } from '@goodboy/core';
import { renameSession as renameSessionInDb } from '@goodboy/db';
import type { AgentId, IsoDateTime, SessionId, TaskModelPreference } from '@goodboy/types';
import { heuristicAgentTitle } from '../../../../shared/lib/agent-title-heuristic';
import { tauriDatabase } from '../../../../shared/lib/db';
import type { GetFn, SetFn } from '../types';

const TITLE_TIMEOUT_MS = 15_000;

const TITLE_SYSTEM_PROMPT =
  'Write a concise imperative title for the user request. Use at most 6 words and the same language as the request. Return plain text only with no quotes or punctuation wrapping.';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly prompt: string;
};

type InvokeResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
};

type GenerateParams = TaskModelPreference &
  Readonly<{
    prompt: string;
  }>;

const parseTitle = ({ stdout }: InvokeResult): string => {
  const raw = stdout.trim();
  let text = raw;
  try {
    const parsed = JSON.parse(raw) as { result?: unknown };
    if (typeof parsed.result === 'string') {
      text = parsed.result;
    }
  } catch {
    text = raw;
  }
  return text.trim().split(/\s+/).slice(0, 6).join(' ');
};

const generateAgentTitle = async ({
  prompt,
  providerId,
  model,
}: GenerateParams): Promise<string> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('agent title generation timed out')),
      TITLE_TIMEOUT_MS,
    );
  });
  try {
    const result = await Promise.race([
      invoke<InvokeResult>('summarize_session', {
        args: {
          providerId,
          model,
          binary: getDefaultBinary(providerId),
          userMessage: prompt,
          systemPrompt: TITLE_SYSTEM_PROMPT,
        },
      }),
      timeout,
    ]);
    if ((result.exitCode ?? 0) !== 0) {
      throw new Error(result.stderr);
    }
    return parseTitle(result);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};

export const applyHeuristicTitle = async ({
  set,
  get,
  sessionId,
  agentId,
  prompt,
}: Params): Promise<void> => {
  try {
    const heuristicTitle = heuristicAgentTitle(prompt);
    if (heuristicTitle == null) {
      return;
    }

    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    if (session == null) {
      return;
    }

    const agent = (get().sessionPhaseRuns[sessionId] ?? []).find(
      (candidate) => candidate.id === agentId,
    );
    const canRenameAgent = agent != null && /^(agent|puppy) \d+$/i.test(agent.name);
    const isFoundingAgent = agent?.ordinal === 0;
    const canRenameSession = isFoundingAgent && !session.titleUserEdited;
    const titleNow = new Date().toISOString() as IsoDateTime;

    if (canRenameSession) {
      set((state) => ({
        sessions: state.sessions.map((candidate) =>
          candidate.id === sessionId ? { ...candidate, goal: heuristicTitle } : candidate,
        ),
      }));
      await renameSessionInDb(tauriDatabase, sessionId, heuristicTitle, titleNow, false);
    }
    if (canRenameAgent) {
      await get().renameAgent(sessionId, agentId, heuristicTitle);
    }
    if (!canRenameSession && !canRenameAgent) {
      return;
    }

    const taskModel = resolveTaskModel(
      'agent_naming',
      get().workspaceOverrides?.[session.workspaceId]?.taskModels,
      session.providerPreference.defaultProvider,
    );
    const generatedTitle = await generateAgentTitle({ prompt, ...taskModel });
    if (generatedTitle.length === 0) {
      return;
    }

    const currentSession = get().sessions.find((candidate) => candidate.id === sessionId);
    const currentAgent = (get().sessionPhaseRuns[sessionId] ?? []).find(
      (candidate) => candidate.id === agentId,
    );
    const shouldRenameSession =
      canRenameSession &&
      currentSession?.titleUserEdited === false &&
      currentSession.goal === heuristicTitle;
    const shouldRenameAgent = canRenameAgent && currentAgent?.name === heuristicTitle;
    const generatedAt = new Date().toISOString() as IsoDateTime;

    if (shouldRenameSession) {
      set((state) => ({
        sessions: state.sessions.map((candidate) =>
          candidate.id === sessionId ? { ...candidate, goal: generatedTitle } : candidate,
        ),
      }));
      await renameSessionInDb(tauriDatabase, sessionId, generatedTitle, generatedAt, false);
    }
    if (shouldRenameAgent) {
      await get().renameAgent(sessionId, agentId, generatedTitle);
    }
  } catch {}
};
