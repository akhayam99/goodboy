import {
  buildHandoff,
  hasSeparateSystemPrompt,
  type HandoffEarlierStep,
  type HandoffFile,
  type HandoffThread,
  type RenderedHandoff,
} from '@goodboy/core';
import type {
  Agent,
  AgentHandoff,
  AgentId,
  GoalAttachment,
  HandoffDraft,
  IsoDateTime,
  MessageAttachment,
  ProviderId,
  Session,
  SessionId,
  SessionProjectMount,
  Step,
  WorkflowRunId,
} from '@goodboy/types';
import { groupThreads } from '../../../features/github/comment-threads';
import { prCommentLocation } from '../../../features/session/pr-comment-location';
import {
  AGENT_KIND_META,
  KIND_TO_ROLE,
  ROLE_LABEL,
  classifyAgent,
  type AgentKind,
} from '../../../features/session/agent-kind';
import { deriveHandoffSender } from './deriveHandoffSender';
import { isTurnWritableMount } from './turnWritableRoots';
import type { GetFn } from './types';

export type HandoffRuleTexts = Readonly<{
  scope: string;
  language: string;
  integrations: string;
  replies: string;
  routing: string;
  cluster: string;
}>;

type Params = {
  readonly get: GetFn;
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly agentKind: AgentKind;
  readonly draft: HandoffDraft | undefined;
  readonly content: string;
  readonly step: Step | null;
  readonly workflowRunId: WorkflowRunId | null;
  readonly earlierSteps: ReadonlyArray<HandoffEarlierStep>;
  readonly attachments: ReadonlyArray<MessageAttachment>;
  readonly goalAttachments: ReadonlyArray<GoalAttachment>;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly rules: HandoffRuleTexts;
  readonly profile: string;
  readonly roleInstructions: string;
  readonly rendered: RenderedHandoff;
  readonly provider: ProviderId;
  readonly createdAt: IsoDateTime;
};

type NamesParams = {
  readonly names: ReadonlyArray<string>;
};

const joinNames = ({ names }: NamesParams): string => {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
};

type ScopeParams = {
  readonly get: GetFn;
  readonly session: Session;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const scopeSummary = ({ get, session, mounts }: ScopeParams): string => {
  const projects = get().projects.filter((project) => project.workspaceId === session.workspaceId);
  const writableIds = new Set<string>(
    mounts.filter(isTurnWritableMount).map((mount) => mount.projectId),
  );
  const writes = projects.filter((project) => writableIds.has(project.id)).map((p) => p.name);
  const reads = projects.filter((project) => !writableIds.has(project.id)).map((p) => p.name);
  if (writes.length === 0 && reads.length === 0) {
    return 'No project in this workspace yet';
  }
  if (writes.length === 0) {
    return `Reads ${joinNames({ names: reads })}`;
  }
  if (reads.length === 0) {
    return `Writes ${joinNames({ names: writes })}`;
  }
  return `Writes ${joinNames({ names: writes })}, reads ${joinNames({ names: reads })}`;
};

type ThreadsParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

const resolveThreads = ({
  get,
  sessionId,
  threadIds,
}: ThreadsParams): ReadonlyArray<HandoffThread> => {
  if (threadIds.length === 0) {
    return [];
  }
  const comments = get().sessionGithub[sessionId]?.detail?.comments ?? [];
  const grouped = groupThreads(comments);
  return threadIds.map((threadId) => {
    const thread = grouped.find(({ head }) => head.threadId === threadId) ?? null;
    return {
      threadId,
      author: thread?.head.author ?? null,
      location: thread === null ? null : prCommentLocation({ comment: thread.head }),
      link: thread?.head.url ?? null,
      body: thread?.head.body ?? '',
    };
  });
};

type FilesParams = {
  readonly attachments: ReadonlyArray<MessageAttachment>;
  readonly goalAttachments: ReadonlyArray<GoalAttachment>;
};

const handoffFiles = ({
  attachments,
  goalAttachments,
}: FilesParams): ReadonlyArray<HandoffFile> => {
  const seen = new Set<string>();
  return [...goalAttachments, ...attachments].flatMap((attachment) => {
    if (seen.has(attachment.relPath)) {
      return [];
    }
    seen.add(attachment.relPath);
    return [{ label: attachment.fileName, path: attachment.relPath }];
  });
};

export const composeAgentHandoff = ({
  get,
  session,
  sessionId,
  agentId,
  agentKind,
  draft,
  content,
  step,
  workflowRunId,
  earlierSteps,
  attachments,
  goalAttachments,
  mounts,
  rules,
  profile,
  roleInstructions,
  rendered,
  provider,
  createdAt,
}: Params): AgentHandoff => {
  const runs = get().sessionPhaseRuns[sessionId] ?? [];
  const agent: Agent | null = runs.find((candidate) => candidate.id === agentId) ?? null;
  const parent =
    agent?.parentAgentId === undefined
      ? null
      : (runs.find((candidate) => candidate.id === agent.parentAgentId) ?? null);
  const workflowRun =
    workflowRunId === null
      ? null
      : (session.workflowRuns.find((run) => run.id === workflowRunId) ?? null);
  const template =
    workflowRun === null
      ? null
      : ((get().phaseTemplates[session.workspaceId] ?? []).find(
          (candidate) => candidate.id === workflowRun.workflowId,
        ) ?? null);
  const threadIds =
    agentKind === 'resolver'
      ? (agent?.sourceThreadIds ??
        (agent?.sourceThreadId === undefined ? [] : [agent.sourceThreadId]))
      : [];
  const prNumber =
    (get().sessionResolveThreads[sessionId] ?? []).find((thread) =>
      threadIds.includes(thread.threadId),
    )?.prNumber ?? null;
  const sender =
    draft?.sender ??
    deriveHandoffSender({
      agent,
      agentKind,
      parent,
      parentKind:
        parent === null
          ? null
          : classifyAgent({ agent: parent, override: get().agentKindOverride[parent.id] ?? null }),
      workflowRun,
      step,
      steps: template?.steps ?? [],
      prNumber,
    });
  const role = step?.role ?? KIND_TO_ROLE[agentKind];
  const goal = draft?.goal ?? workflowRun?.goal ?? template?.goal ?? session.goal;
  return buildHandoff({
    agentId,
    provider,
    createdAt,
    sender,
    instruction: draft?.instruction ?? content,
    why: draft?.why ?? step?.orchestratorReason ?? null,
    doneWhen: step?.expectedOutput ?? AGENT_KIND_META[agentKind].expectedOutput,
    goal: goal ?? null,
    earlierSteps,
    plan: draft?.plan ?? null,
    files: handoffFiles({ attachments, goalAttachments }),
    threads: resolveThreads({ get, sessionId, threadIds }),
    scopeSummary: scopeSummary({ get, session, mounts }),
    rules: [
      { label: 'Projects', text: rules.scope },
      { label: 'Language', text: rules.language },
      { label: 'Integrations', text: rules.integrations },
      { label: 'Replies', text: rules.replies },
      { label: 'Routing', text: rules.routing },
      { label: 'Stops', text: rules.cluster },
    ],
    profile,
    role: { label: ROLE_LABEL[role], instructions: roleInstructions, isEdited: false },
    sent: {
      system: hasSeparateSystemPrompt({ provider }) ? rendered.system : null,
      message: rendered.message,
    },
  });
};
