import type { WorkspaceId } from '@goodboy/types';

type ReadParams = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = ReadParams & {
  readonly overrides: Readonly<Record<string, boolean>>;
};

const storageKey = ({ workspaceId }: ReadParams): string =>
  `goodboy:scripts-packages-collapsed:v1:${workspaceId}`;

const isBooleanRecord = (value: unknown): value is Readonly<Record<string, boolean>> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === 'boolean');

export const readPackagesCollapsedOverrides = ({
  workspaceId,
}: ReadParams): Readonly<Record<string, boolean>> => {
  try {
    const raw = localStorage.getItem(storageKey({ workspaceId }));
    if (raw === null) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return isBooleanRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const writePackagesCollapsedOverrides = ({ workspaceId, overrides }: WriteParams): void => {
  try {
    localStorage.setItem(storageKey({ workspaceId }), JSON.stringify(overrides));
  } catch {
    return;
  }
};
