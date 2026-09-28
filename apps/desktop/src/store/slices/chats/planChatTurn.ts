import type { ChatMessage, ChatSummary, ProviderRunId } from '@goodboy/types';
import { buildChatSystemPrompt } from '../../../features/workspace-chat/buildChatSystemPrompt';
import { buildChatTurnPrompt } from '../../../features/workspace-chat/buildChatTurnPrompt';
import { chatWorkingFolder } from '../../../features/workspace-chat/chatWorkingFolder';
import {
  resolveChatModel,
  type ChatModelArgs,
} from '../../../features/workspace-chat/resolveChatModel';
import type { ChatTurnRequest } from '../../../features/workspace-chat/runChatTurn';
import type { GetFn } from './types';

export const NO_PROJECT_MESSAGE = 'Add a project to this workspace to ask about its code.';

export type ChatTurnPlan =
  | { readonly kind: 'ready'; readonly request: ChatTurnRequest }
  | { readonly kind: 'blocked'; readonly error: string };

type Params = {
  readonly state: ReturnType<GetFn>;
  readonly chat: ChatSummary;
  readonly history: ReadonlyArray<ChatMessage>;
  readonly question: string;
  readonly runId: ProviderRunId;
};

type ModelPlanParams = Pick<Params, 'chat'>;

type ModelPlan =
  | { readonly kind: 'ready'; readonly args: ChatModelArgs }
  | { readonly kind: 'blocked'; readonly error: string };

const planModel = ({ chat }: ModelPlanParams): ModelPlan => {
  try {
    return {
      kind: 'ready',
      args: resolveChatModel({ provider: chat.provider, modelKey: chat.model }),
    };
  } catch (error) {
    return { kind: 'blocked', error: error instanceof Error ? error.message : String(error) };
  }
};

export const planChatTurn = ({ state, chat, history, question, runId }: Params): ChatTurnPlan => {
  const projects = state.projects.filter(
    (project) => project.workspaceId === chat.workspaceId && project.disconnectedAt === undefined,
  );
  const folder = chatWorkingFolder({ roots: projects.map((project) => project.rootPath) });
  if (folder === null) {
    return { kind: 'blocked', error: NO_PROJECT_MESSAGE };
  }
  const model = planModel({ chat });
  if (model.kind === 'blocked') {
    return model;
  }
  const workspace = state.workspaces.find((candidate) => candidate.id === chat.workspaceId);
  const binary = state.providers.find((provider) => provider.id === chat.provider)?.binary;
  return {
    kind: 'ready',
    request: {
      runId,
      chatId: chat.id,
      provider: chat.provider,
      model: model.args.model,
      ...(model.args.effort !== undefined && { effort: model.args.effort }),
      workingDir: folder.workingDir,
      readRoots: folder.readRoots,
      prompt: buildChatTurnPrompt({ history, question }),
      systemPrompt: buildChatSystemPrompt({
        workspaceName: workspace?.name ?? 'current',
        projects: projects.map((project) => ({
          name: project.name,
          rootPath: project.rootPath,
          description: project.description ?? null,
        })),
      }),
      ...(binary !== undefined && { binary }),
    },
  };
};
