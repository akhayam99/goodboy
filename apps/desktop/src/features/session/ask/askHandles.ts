import type { AgentId, ArtifactId, OpenQuestionId, WorkflowRunId } from '@goodboy/types';

export type AskTarget =
  | { readonly kind: 'agent'; readonly agentId: AgentId }
  | { readonly kind: 'run'; readonly runId: WorkflowRunId }
  | { readonly kind: 'question'; readonly questionId: OpenQuestionId }
  | { readonly kind: 'comment'; readonly threadId: string }
  | { readonly kind: 'pr'; readonly number: number }
  | { readonly kind: 'artifact'; readonly artifactId: ArtifactId; readonly isPlan: boolean }
  | { readonly kind: 'file'; readonly path: string; readonly line: number | null };

export type AskHandle = {
  readonly key: string;
  readonly label: string;
  readonly target: AskTarget;
};

export type AskDossierFile = {
  readonly name: string;
  readonly content: string;
};

const FILE_REFERENCE = /^([A-Za-z0-9_.\-/]+\.[A-Za-z0-9]+)(?::(\d+))?$/;

const STABLE_REFERENCE = /^(agent|run|question|comment|pr|plan|doc|file):([^|]+)\|(.+)$/;

type TextParams = {
  readonly text: string;
};

export const fileHandleOf = ({ text }: TextParams): AskHandle | null => {
  const match = FILE_REFERENCE.exec(text.trim());
  if (match === null) {
    return null;
  }
  const path = match[1] ?? '';
  const line = match[2] === undefined ? null : Number(match[2]);
  const name = path.split('/').pop() ?? path;
  return {
    key: text.trim(),
    label: line === null ? name : `${name}:${line}`,
    target: { kind: 'file', path, line },
  };
};

const targetRef = (target: AskTarget): string => {
  switch (target.kind) {
    case 'agent':
      return `agent:${target.agentId}`;
    case 'run':
      return `run:${target.runId}`;
    case 'question':
      return `question:${target.questionId}`;
    case 'comment':
      return `comment:${target.threadId}`;
    case 'pr':
      return `pr:${target.number}`;
    case 'artifact':
      return `${target.isPlan ? 'plan' : 'doc'}:${target.artifactId}`;
    case 'file':
      return `file:${target.line === null ? target.path : `${target.path}#${target.line}`}`;
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
};

const safeLabel = (label: string): string => label.replace(/[[\]|\n]/g, ' ').trim();

export const encodeAskHandle = (handle: AskHandle): string =>
  `[[${targetRef(handle.target)}|${safeLabel(handle.label)}]]`;

const targetOf = ({
  kind,
  id,
}: {
  readonly kind: string;
  readonly id: string;
}): AskTarget | null => {
  switch (kind) {
    case 'agent':
      return { kind: 'agent', agentId: id as AgentId };
    case 'run':
      return { kind: 'run', runId: id as WorkflowRunId };
    case 'question':
      return { kind: 'question', questionId: id as OpenQuestionId };
    case 'comment':
      return { kind: 'comment', threadId: id };
    case 'pr': {
      const number = Number(id);
      return Number.isInteger(number) ? { kind: 'pr', number } : null;
    }
    case 'plan':
    case 'doc':
      return { kind: 'artifact', artifactId: id as ArtifactId, isPlan: kind === 'plan' };
    case 'file': {
      const [path = '', line] = id.split('#');
      return { kind: 'file', path, line: line === undefined ? null : Number(line) };
    }
    default:
      return null;
  }
};

export const decodeAskHandle = ({ text }: TextParams): AskHandle | null => {
  const match = STABLE_REFERENCE.exec(text.trim());
  if (match === null) {
    return null;
  }
  const target = targetOf({ kind: match[1] ?? '', id: match[2] ?? '' });
  return target === null ? null : { key: text.trim(), label: match[3] ?? '', target };
};
