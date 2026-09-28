import type { ProjectId, SearchKind } from '@goodboy/types';
import type { SearchChip } from './searchChips';

export type SearchProjectOption = {
  readonly id: ProjectId;
  readonly name: string;
};

const TYPE_ALIASES: Readonly<
  Record<string, { readonly kinds: ReadonlyArray<SearchKind>; readonly label: string }>
> = {
  session: { kinds: ['session'], label: 'Sessions' },
  sessions: { kinds: ['session'], label: 'Sessions' },
  message: { kinds: ['message'], label: 'Messages' },
  messages: { kinds: ['message'], label: 'Messages' },
  msg: { kinds: ['message'], label: 'Messages' },
  agent: { kinds: ['agent'], label: 'Agents' },
  agents: { kinds: ['agent'], label: 'Agents' },
  plan: { kinds: ['plan'], label: 'Plans' },
  plans: { kinds: ['plan'], label: 'Plans' },
  report: { kinds: ['report'], label: 'Reports' },
  reports: { kinds: ['report'], label: 'Reports' },
  wireframe: { kinds: ['wireframe'], label: 'Wireframes' },
  wireframes: { kinds: ['wireframe'], label: 'Wireframes' },
  artifact: { kinds: ['plan', 'report', 'wireframe'], label: 'Artifacts' },
  artifacts: { kinds: ['plan', 'report', 'wireframe'], label: 'Artifacts' },
  decision: { kinds: ['decision'], label: 'Decisions' },
  decisions: { kinds: ['decision'], label: 'Decisions' },
  question: { kinds: ['question'], label: 'Questions' },
  questions: { kinds: ['question'], label: 'Questions' },
  issue: { kinds: ['issue'], label: 'Issues' },
  issues: { kinds: ['issue'], label: 'Issues' },
  pr: { kinds: ['pr'], label: 'Pull requests' },
  prs: { kinds: ['pr'], label: 'Pull requests' },
  branch: { kinds: ['branch'], label: 'Branches' },
  branches: { kinds: ['branch'], label: 'Branches' },
  workflow: { kinds: ['workflow'], label: 'Workflows' },
  workflows: { kinds: ['workflow'], label: 'Workflows' },
  comment: { kinds: ['comment'], label: 'Comments' },
  comments: { kinds: ['comment'], label: 'Comments' },
};

const PROVIDER_ALIASES: Readonly<
  Record<string, { readonly provider: string; readonly label: string }>
> = {
  claude: { provider: 'anthropic', label: 'Claude' },
  anthropic: { provider: 'anthropic', label: 'Claude' },
  codex: { provider: 'codex', label: 'Codex' },
  cursor: { provider: 'cursor', label: 'Cursor' },
  gemini: { provider: 'gemini', label: 'Gemini' },
  opencode: { provider: 'opencode', label: 'OpenCode' },
  openrouter: { provider: 'openrouter', label: 'OpenRouter' },
  moonshot: { provider: 'moonshot', label: 'Moonshot' },
  linear: { provider: 'linear', label: 'Linear' },
  jira: { provider: 'jira', label: 'Jira' },
  github: { provider: 'github', label: 'GitHub' },
  gitlab: { provider: 'gitlab', label: 'GitLab' },
  bitbucket: { provider: 'bitbucket', label: 'Bitbucket' },
  sentry: { provider: 'sentry', label: 'Sentry' },
};

const STATUS_LABELS: Readonly<Record<string, string>> = {
  open: 'Open',
  draft: 'Draft',
  approved: 'Approved',
  queued: 'Queued',
  merged: 'Merged',
  closed: 'Closed',
  active: 'Active',
  consumed: 'Consumed',
  superseded: 'Superseded',
  discarded: 'Discarded',
  replaced: 'Replaced',
  withdrawn: 'Withdrawn',
  answered: 'Answered',
  dismissed: 'Dismissed',
  running: 'Running',
  idle: 'Idle',
  error: 'Error',
  ended: 'Ended',
  done: 'Done',
  attached: 'Attached',
  resolved: 'Resolved',
  detached: 'Detached',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const QUALIFIER = /^(type|in|from|is|after|before):(.+)$/i;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RELATIVE = /^(\d{1,3})([dw])$/;

type DateParams = {
  readonly value: string;
  readonly now: number;
};

type StartOfDayParams = {
  readonly at: number;
};

const startOfDay = ({ at }: StartOfDayParams): number => {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const parseDate = ({ value, now }: DateParams): number | null => {
  const lowered = value.toLowerCase();
  if (lowered === 'today') {
    return startOfDay({ at: now });
  }
  if (lowered === 'yesterday') {
    return startOfDay({ at: now - DAY_MS });
  }
  const relative = RELATIVE.exec(lowered);
  if (relative !== null) {
    const amount = Number(relative[1]);
    const unit = relative[2] === 'w' ? 7 * DAY_MS : DAY_MS;
    return startOfDay({ at: now - amount * unit });
  }
  const iso = ISO_DATE.exec(value);
  if (iso === null) {
    return null;
  }
  const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

type ChipParams = {
  readonly key: string;
  readonly value: string;
  readonly projects: ReadonlyArray<SearchProjectOption>;
  readonly now: number;
};

const qualifierChip = ({ key, value, projects, now }: ChipParams): SearchChip | null => {
  const lowered = value.toLowerCase();
  const name = key.toLowerCase();
  if (name === 'type') {
    const alias = TYPE_ALIASES[lowered];
    return alias === undefined ? null : { key: 'type', kinds: alias.kinds, label: alias.label };
  }
  if (name === 'in') {
    const project = projects.find((candidate) => candidate.name.toLowerCase() === lowered);
    return project === undefined
      ? null
      : { key: 'project', projectId: project.id, label: project.name };
  }
  if (name === 'from') {
    const alias = PROVIDER_ALIASES[lowered];
    return alias === undefined ? null : { key: 'provider', ...alias };
  }
  if (name === 'is') {
    if (lowered === 'archived') {
      return { key: 'archived', label: 'Archived' };
    }
    const label = STATUS_LABELS[lowered];
    return label === undefined ? null : { key: 'status', status: lowered, label };
  }
  const at = parseDate({ value, now });
  if (at === null) {
    return null;
  }
  const label = new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return name === 'after' ? { key: 'after', at, label } : { key: 'before', at, label };
};

export type ExtractedQuery = {
  readonly text: string;
  readonly chips: ReadonlyArray<SearchChip>;
};

type ExtractParams = {
  readonly text: string;
  readonly projects: ReadonlyArray<SearchProjectOption>;
  readonly now: number;
  readonly isFinal: boolean;
};

export const extractQualifiers = ({
  text,
  projects,
  now,
  isFinal,
}: ExtractParams): ExtractedQuery => {
  const parts = text.split(/(\s+)/);
  const lastWordIndex = parts.reduce(
    (last, part, index) => (part.trim().length > 0 ? index : last),
    -1,
  );
  const hasTrailingSpace = /\s$/.test(text);
  const chips: SearchChip[] = [];
  const kept = parts.map((part, index) => {
    const match = QUALIFIER.exec(part);
    const isStillTyping = index === lastWordIndex && !hasTrailingSpace && !isFinal;
    if (match === null || isStillTyping) {
      return part;
    }
    const chip = qualifierChip({ key: match[1] ?? '', value: match[2] ?? '', projects, now });
    if (chip === null) {
      return part;
    }
    chips.push(chip);
    return '';
  });
  if (chips.length === 0) {
    return { text, chips };
  }
  return {
    text: kept
      .join('')
      .replace(/\s{2,}/g, ' ')
      .trimStart(),
    chips,
  };
};
