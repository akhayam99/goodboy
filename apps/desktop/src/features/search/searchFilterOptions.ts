import type { ProjectId, SearchKind } from '@goodboy/types';
import type { SearchChip } from './searchChips';

const DAY_MS = 24 * 60 * 60 * 1000;

export const TYPE_OPTIONS: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
  readonly kinds: ReadonlyArray<SearchKind>;
}> = [
  { value: 'session', label: 'Sessions', kinds: ['session'] },
  { value: 'message', label: 'Messages', kinds: ['message'] },
  { value: 'agent', label: 'Agents', kinds: ['agent'] },
  { value: 'artifact', label: 'Plans and reports', kinds: ['plan', 'report', 'wireframe'] },
  { value: 'decision', label: 'Decisions', kinds: ['decision'] },
  { value: 'question', label: 'Questions', kinds: ['question'] },
  { value: 'issue', label: 'Issues', kinds: ['issue'] },
  { value: 'pr', label: 'Pull requests', kinds: ['pr'] },
  { value: 'branch', label: 'Branches', kinds: ['branch'] },
  { value: 'workflow', label: 'Workflows', kinds: ['workflow'] },
  { value: 'comment', label: 'Comments', kinds: ['comment'] },
];

export const PROVIDER_OPTIONS: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
  { value: 'anthropic', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'linear', label: 'Linear' },
  { value: 'jira', label: 'Jira' },
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'sentry', label: 'Sentry' },
];

export const STATUS_OPTIONS: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
  { value: 'archived', label: 'Archived' },
  { value: 'open', label: 'Open' },
  { value: 'merged', label: 'Merged' },
  { value: 'active', label: 'Active' },
  { value: 'answered', label: 'Answered' },
  { value: 'running', label: 'Running' },
  { value: 'discarded', label: 'Discarded' },
];

export const DATE_OPTIONS: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
  readonly days: number;
}> = [
  { value: '1', label: 'Today', days: 0 },
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '365', label: 'Last year', days: 365 },
];

type TypeChipParams = {
  readonly value: string;
};

export const typeChipOf = ({ value }: TypeChipParams): SearchChip | null => {
  const option = TYPE_OPTIONS.find((candidate) => candidate.value === value);
  return option === undefined ? null : { key: 'type', kinds: option.kinds, label: option.label };
};

type ProjectChipParams = {
  readonly projectId: ProjectId;
  readonly name: string;
};

export const projectChipOf = ({ projectId, name }: ProjectChipParams): SearchChip => ({
  key: 'project',
  projectId,
  label: name,
});

export const providerChipOf = ({ value }: TypeChipParams): SearchChip | null => {
  const option = PROVIDER_OPTIONS.find((candidate) => candidate.value === value);
  return option === undefined ? null : { key: 'provider', provider: value, label: option.label };
};

export const statusChipOf = ({ value }: TypeChipParams): SearchChip | null => {
  const option = STATUS_OPTIONS.find((candidate) => candidate.value === value);
  if (option === undefined) {
    return null;
  }
  return value === 'archived'
    ? { key: 'archived', label: option.label }
    : { key: 'status', status: value, label: option.label };
};

type DateChipParams = {
  readonly value: string;
  readonly now: number;
};

export const dateChipOf = ({ value, now }: DateChipParams): SearchChip | null => {
  const option = DATE_OPTIONS.find((candidate) => candidate.value === value);
  if (option === undefined) {
    return null;
  }
  const start = new Date(now - option.days * DAY_MS);
  start.setHours(0, 0, 0, 0);
  return { key: 'after', at: start.getTime(), label: option.label };
};

type ChipValueParams = {
  readonly chip: SearchChip;
};

export const chipValue = ({ chip }: ChipValueParams): string => {
  switch (chip.key) {
    case 'type':
      return TYPE_OPTIONS.find((option) => option.kinds.join() === chip.kinds.join())?.value ?? '';
    case 'project':
      return chip.projectId;
    case 'provider':
      return chip.provider;
    case 'status':
      return chip.status;
    case 'archived':
      return 'archived';
    case 'after':
    case 'before':
      return DATE_OPTIONS.find((option) => option.label === chip.label)?.value ?? '';
    default: {
      const exhaustive: never = chip;
      return exhaustive;
    }
  }
};

type ProviderLabelParams = {
  readonly provider: string | null;
};

export const providerLabel = ({ provider }: ProviderLabelParams): string | null => {
  if (provider === null) {
    return null;
  }
  return PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
};
