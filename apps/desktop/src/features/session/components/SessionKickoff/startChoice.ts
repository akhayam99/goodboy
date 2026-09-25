import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../../shared/lib/storage-keys';

export type StartChoice = 'task' | 'workflow' | 'scout';

export const START_CHOICES: ReadonlyArray<StartChoice> = ['task', 'workflow', 'scout'];

type Params = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = Params & {
  readonly choice: StartChoice;
};

type PreselectParams = {
  readonly stored: StartChoice | null;
  readonly hasTrackerCandidates: boolean;
};

const storageKey = ({ workspaceId }: Params): string =>
  `${STORAGE_PREFIXES.kickoffStartChoice}${workspaceId}`;

const isStartChoice = (value: unknown): value is StartChoice =>
  typeof value === 'string' && START_CHOICES.some((candidate) => candidate === value);

export const readLastStartChoice = ({ workspaceId }: Params): StartChoice | null => {
  try {
    const raw = localStorage.getItem(storageKey({ workspaceId }));
    return isStartChoice(raw) ? raw : null;
  } catch {
    return null;
  }
};

export const writeLastStartChoice = ({ workspaceId, choice }: WriteParams): void => {
  try {
    localStorage.setItem(storageKey({ workspaceId }), choice);
  } catch {
    return;
  }
};

export const preselectStartChoice = ({
  stored,
  hasTrackerCandidates,
}: PreselectParams): StartChoice => {
  if (stored != null) {
    return stored;
  }
  return hasTrackerCandidates ? 'task' : 'workflow';
};
