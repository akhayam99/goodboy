import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../shared/lib/storage-keys';
import { storageKeyOf } from '../../shared/lib/storageKeyOf';

type ReadParams = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = ReadParams & {
  readonly overrides: Readonly<Record<string, boolean>>;
};

const isBooleanRecord = (value: unknown): value is Readonly<Record<string, boolean>> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === 'boolean');

const NO_OVERRIDES: Readonly<Record<string, boolean>> = {};

const overridesPref = ({ workspaceId }: ReadParams) =>
  persistedPref<Readonly<Record<string, boolean>>>({
    key: storageKeyOf({ prefix: STORAGE_PREFIXES.scriptsPackagesCollapsed, id: workspaceId }),
    fallback: NO_OVERRIDES,
    parse: (raw) => {
      const parsed: unknown = JSON.parse(raw);
      return isBooleanRecord(parsed) ? parsed : undefined;
    },
  });

export const readPackagesCollapsedOverrides = ({
  workspaceId,
}: ReadParams): Readonly<Record<string, boolean>> => overridesPref({ workspaceId }).read();

export const writePackagesCollapsedOverrides = ({ workspaceId, overrides }: WriteParams): void =>
  overridesPref({ workspaceId }).write(overrides);
