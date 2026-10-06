import type {
  AgentId,
  AgentStatus,
  ArtifactId,
  OpenQuestionId,
  WorkflowRunId,
} from '@goodboy/types';
import { redactSecrets } from '../../../shared/utils/redactSecrets';
import { clipToBoundary } from '../../reports/allocateReportContext';
import { RESOLVE_WORD_LABEL, type ResolveWord } from '../../resolve/commentProjection';
import type { AskDossierFile, AskHandle } from './askHandles';

const ASK_PACK_LIMITS = {
  total: 48_000,
  goal: 1_200,
  decisions: 2_400,
  summary: 2_500,
  liveSummary: 2_000,
  settledPreview: 280,
  settledAgents: 15,
  answeredQuestions: 3,
  finishedRuns: 2,
  comments: 10,
  events: 20,
  artifacts: 12,
  transcriptTail: 6_000,
  transcriptFiles: 8,
} as const;

export type AskPackAgent = {
  readonly id: AgentId;
  readonly name: string;
  readonly status: AgentStatus;
  readonly isNeedsYou: boolean;
  readonly summary: string;
  readonly since: string | null;
  readonly transcriptTail: string;
};

type AskPackQuestion = {
  readonly id: OpenQuestionId;
  readonly text: string;
  readonly from: string | null;
  readonly isOpen: boolean;
  readonly answer: string | null;
  readonly suggestions: ReadonlyArray<string>;
};

export type AskPackRun = {
  readonly id: WorkflowRunId;
  readonly title: string;
  readonly isRunning: boolean;
  readonly detail: string;
};

export type AskPackComment = {
  readonly threadId: string;
  readonly word: ResolveWord;
  readonly author: string | null;
  readonly location: string | null;
  readonly body: string;
};

type AskPackArtifact = {
  readonly id: ArtifactId;
  readonly title: string;
  readonly kind: string;
  readonly isPlan: boolean;
};

type AskPackBranch = {
  readonly mountName: string;
  readonly branch: string;
  readonly baseBranch: string | null;
};

type AskPackPullRequest = {
  readonly number: number;
  readonly title: string;
  readonly state: string;
};

export type AskPackInput = {
  readonly title: string;
  readonly rightNow: ReadonlyArray<string>;
  readonly goal: string;
  readonly decisions: string;
  readonly summary: string;
  readonly agents: ReadonlyArray<AskPackAgent>;
  readonly questions: ReadonlyArray<AskPackQuestion>;
  readonly runs: ReadonlyArray<AskPackRun>;
  readonly comments: ReadonlyArray<AskPackComment>;
  readonly branches: ReadonlyArray<AskPackBranch>;
  readonly pullRequest: AskPackPullRequest | null;
  readonly artifacts: ReadonlyArray<AskPackArtifact>;
  readonly events: ReadonlyArray<string>;
};

export type AskPack = {
  readonly text: string;
  readonly handles: ReadonlyArray<AskHandle>;
  readonly files: ReadonlyArray<AskDossierFile>;
  readonly truncations: ReadonlyArray<string>;
};

type Section = {
  readonly title: string;
  readonly lines: ReadonlyArray<string>;
};

const clean = (text: string): string => redactSecrets({ text }).trim();

type ClipParams = {
  readonly text: string;
  readonly limit: number;
  readonly label: string;
  readonly truncations: Array<string>;
};

const clip = ({ text, limit, label, truncations }: ClipParams): string => {
  const clipped = clipToBoundary({ text: clean(text), limit });
  if (clipped.isClipped) {
    truncations.push(`${label} cut at ${limit} characters`);
  }
  return clipped.text;
};

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

const agentRank = (agent: AskPackAgent): number => {
  if (agent.isNeedsYou) {
    return 0;
  }
  if (agent.status === 'running') {
    return 1;
  }
  if (agent.status === 'failed') {
    return 2;
  }
  return 3;
};

const isLive = (agent: AskPackAgent): boolean => agentRank(agent) < 3;

const STATUS_WORD: Readonly<Record<AgentStatus, string>> = {
  pending: 'waiting to start',
  running: 'running',
  completed: 'done',
  failed: 'failed',
  blocked: 'blocked',
  skipped: 'skipped',
  stopped: 'stopped',
};

type Collector = {
  readonly handles: Array<AskHandle>;
  readonly files: Array<AskDossierFile>;
  readonly truncations: Array<string>;
};

const agentSection = ({
  agents,
  collector,
}: {
  readonly agents: ReadonlyArray<AskPackAgent>;
  readonly collector: Collector;
}): Section => {
  const ordered = [...agents].sort((left, right) => agentRank(left) - agentRank(right));
  const live = ordered.filter(isLive);
  const settled = ordered.filter((agent) => !isLive(agent));
  const shown = [...live, ...settled.slice(0, ASK_PACK_LIMITS.settledAgents)];
  const hidden = ordered.length - shown.length;
  const lines = shown.map((agent, index) => {
    const key = `A${index + 1}`;
    collector.handles.push({
      key,
      label: agent.name,
      target: { kind: 'agent', agentId: agent.id },
    });
    const word = agent.isNeedsYou ? 'needs you' : STATUS_WORD[agent.status];
    const since = agent.since === null ? '' : ` since ${agent.since}`;
    const limit = isLive(agent) ? ASK_PACK_LIMITS.liveSummary : ASK_PACK_LIMITS.settledPreview;
    const summary =
      agent.summary.trim() === ''
        ? ''
        : `: ${oneLine(clip({ text: agent.summary, limit, label: `${key} summary`, truncations: collector.truncations }))}`;
    const tail = agent.transcriptTail.trim();
    if (tail !== '' && collector.files.length < ASK_PACK_LIMITS.transcriptFiles) {
      collector.files.push({
        name: `agents/${key}.md`,
        content: `# ${agent.name}, end of its transcript\n\n${clip({
          text: tail.slice(-ASK_PACK_LIMITS.transcriptTail * 2),
          limit: ASK_PACK_LIMITS.transcriptTail,
          label: `${key} transcript`,
          truncations: [],
        })}\n`,
      });
    }
    return `- [${key}] ${agent.name} · ${word}${since}${summary}`;
  });
  if (hidden > 0) {
    lines.push(`- and ${hidden} more settled agents`);
  }
  return { title: 'Agents', lines };
};

const questionSection = ({
  questions,
  collector,
}: {
  readonly questions: ReadonlyArray<AskPackQuestion>;
  readonly collector: Collector;
}): ReadonlyArray<Section> => {
  const open = questions.filter((question) => question.isOpen);
  const answered = questions
    .filter((question) => !question.isOpen)
    .slice(-ASK_PACK_LIMITS.answeredQuestions);
  const line = (question: AskPackQuestion): string => {
    const key = `Q${collector.handles.filter((handle) => handle.target.kind === 'question').length + 1}`;
    collector.handles.push({
      key,
      label: `Question ${key.slice(1)}`,
      target: { kind: 'question', questionId: question.id },
    });
    const from = question.from === null ? '' : ` from ${question.from}`;
    const text = oneLine(clean(question.text));
    if (!question.isOpen) {
      return `- [${key}]${from}: ${text} · answered: ${oneLine(clean(question.answer ?? ''))}`;
    }
    const options =
      question.suggestions.length === 0 ? '' : ` · options: ${question.suggestions.join(' | ')}`;
    return `- [${key}]${from}: ${text}${options}`;
  };
  return [
    { title: 'Open questions', lines: open.map(line) },
    { title: 'Answered questions', lines: answered.map(line) },
  ];
};

const runSection = ({
  runs,
  collector,
}: {
  readonly runs: ReadonlyArray<AskPackRun>;
  readonly collector: Collector;
}): Section => {
  const running = runs.filter((run) => run.isRunning);
  const finished = runs.filter((run) => !run.isRunning).slice(-ASK_PACK_LIMITS.finishedRuns);
  const lines = [...running, ...finished].map((run, index) => {
    const key = `R${index + 1}`;
    collector.handles.push({ key, label: run.title, target: { kind: 'run', runId: run.id } });
    return `- [${key}] ${run.title} · ${run.isRunning ? 'running' : 'finished'} · ${oneLine(run.detail)}`;
  });
  return { title: 'Runs', lines };
};

const WORD_ORDER: ReadonlyArray<ResolveWord> = [
  'ready',
  'needs_you',
  'working',
  'couldnt_fix',
  'open',
  'done',
];

const commentSection = ({
  comments,
  pullRequest,
  collector,
}: {
  readonly comments: ReadonlyArray<AskPackComment>;
  readonly pullRequest: AskPackPullRequest | null;
  readonly collector: Collector;
}): Section => {
  const counts = WORD_ORDER.flatMap((word) => {
    const count = comments.filter((comment) => comment.word === word).length;
    return count === 0 ? [] : [`${count} ${RESOLVE_WORD_LABEL[word].toLowerCase()}`];
  });
  const listed = comments
    .filter((comment) => comment.word === 'needs_you' || comment.word === 'couldnt_fix')
    .slice(0, ASK_PACK_LIMITS.comments);
  const lines = listed.map((comment, index) => {
    const key = `C${index + 1}`;
    collector.handles.push({
      key,
      label: comment.location ?? `Comment ${index + 1}`,
      target: { kind: 'comment', threadId: comment.threadId },
    });
    const author = comment.author === null ? '' : `${comment.author}: `;
    const where = comment.location === null ? '' : `${comment.location} · `;
    return `- [${key}] ${where}${RESOLVE_WORD_LABEL[comment.word]} · ${author}${oneLine(clean(comment.body)).slice(0, 400)}`;
  });
  const on = pullRequest === null ? '' : ` on #${pullRequest.number}`;
  return {
    title: `Review comments${on}`,
    lines:
      comments.length === 0 ? [] : [`${comments.length} comments: ${counts.join(' · ')}`, ...lines],
  };
};

const branchSection = ({
  branches,
  pullRequest,
  collector,
}: {
  readonly branches: ReadonlyArray<AskPackBranch>;
  readonly pullRequest: AskPackPullRequest | null;
  readonly collector: Collector;
}): Section => {
  const lines = branches.map((branch) => {
    const base = branch.baseBranch === null ? '' : ` from ${branch.baseBranch}`;
    return `- ${branch.mountName}: ${branch.branch}${base}`;
  });
  if (pullRequest !== null) {
    collector.handles.push({
      key: 'PR',
      label: `#${pullRequest.number}`,
      target: { kind: 'pr', number: pullRequest.number },
    });
    lines.push(`- [PR] #${pullRequest.number} ${pullRequest.state}: ${oneLine(pullRequest.title)}`);
  }
  return { title: 'Branch and pull request', lines };
};

const artifactSection = ({
  artifacts,
  collector,
}: {
  readonly artifacts: ReadonlyArray<AskPackArtifact>;
  readonly collector: Collector;
}): Section => ({
  title: 'Artifacts',
  lines: artifacts.slice(-ASK_PACK_LIMITS.artifacts).map((artifact, index) => {
    const key = `D${index + 1}`;
    collector.handles.push({
      key,
      label: artifact.title,
      target: { kind: 'artifact', artifactId: artifact.id, isPlan: artifact.isPlan },
    });
    return `- [${key}] ${oneLine(artifact.title)} · ${artifact.kind}`;
  }),
});

const render = ({ title, lines }: Section): string =>
  lines.length === 0 ? '' : [`## ${title}`, ...lines].join('\n');

const prose = ({
  title,
  text,
  limit,
  truncations,
}: {
  readonly title: string;
  readonly text: string;
  readonly limit: number;
  readonly truncations: Array<string>;
}): Section => {
  const body = clip({ text, limit, label: title, truncations });
  return { title, lines: body === '' ? [] : [body] };
};

export const buildAskPack = (input: AskPackInput): AskPack => {
  const collector: Collector = { handles: [], files: [], truncations: [] };
  const sections: ReadonlyArray<Section> = [
    { title: 'Right now', lines: input.rightNow.map((line) => `- ${line}`) },
    prose({
      title: 'Goal',
      text: input.goal,
      limit: ASK_PACK_LIMITS.goal,
      truncations: collector.truncations,
    }),
    agentSection({ agents: input.agents, collector }),
    ...questionSection({ questions: input.questions, collector }),
    runSection({ runs: input.runs, collector }),
    commentSection({ comments: input.comments, pullRequest: input.pullRequest, collector }),
    branchSection({ branches: input.branches, pullRequest: input.pullRequest, collector }),
    artifactSection({ artifacts: input.artifacts, collector }),
    {
      title: 'Recent events',
      lines: input.events.slice(-ASK_PACK_LIMITS.events).map((line) => `- ${oneLine(line)}`),
    },
    prose({
      title: 'Decisions',
      text: input.decisions,
      limit: ASK_PACK_LIMITS.decisions,
      truncations: collector.truncations,
    }),
    prose({
      title: 'Summary',
      text: input.summary,
      limit: ASK_PACK_LIMITS.summary,
      truncations: collector.truncations,
    }),
  ];
  const head = `# Session: ${oneLine(clean(input.title))}`;
  const body = [head, ...sections.map(render).filter((block) => block !== '')].join('\n\n');
  const fitted = clipToBoundary({ text: body, limit: ASK_PACK_LIMITS.total });
  if (fitted.isClipped) {
    collector.truncations.push(`session pack cut at ${ASK_PACK_LIMITS.total} characters`);
  }
  return {
    text: fitted.text,
    handles: collector.handles,
    files: collector.files,
    truncations: collector.truncations,
  };
};
