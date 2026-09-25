import type { Migration } from './index';

export const NEWER_BUILD_MESSAGE = 'This database was upgraded by a newer Goodboy.';

type DatabaseFromNewerBuildErrorParams = {
  readonly unknownVersions: ReadonlyArray<number>;
  readonly highestKnownVersion: number;
};

export class DatabaseFromNewerBuildError extends Error {
  public readonly unknownVersions: ReadonlyArray<number>;
  public readonly highestKnownVersion: number;

  constructor({ unknownVersions, highestKnownVersion }: DatabaseFromNewerBuildErrorParams) {
    super(NEWER_BUILD_MESSAGE);
    this.name = 'DatabaseFromNewerBuildError';
    this.unknownVersions = unknownVersions;
    this.highestKnownVersion = highestKnownVersion;
  }
}

type AssertKnownMigrationsParams = {
  readonly appliedVersions: ReadonlyArray<number>;
  readonly migrations: ReadonlyArray<Migration>;
};

export const assertKnownMigrations = ({
  appliedVersions,
  migrations,
}: AssertKnownMigrationsParams): void => {
  const highestKnownVersion = migrations.reduce(
    (highest, migration) => Math.max(highest, migration.version),
    0,
  );
  const unknownVersions = appliedVersions
    .filter((version) => version > highestKnownVersion)
    .sort((left, right) => left - right);
  if (unknownVersions.length === 0) {
    return;
  }
  throw new DatabaseFromNewerBuildError({ unknownVersions, highestKnownVersion });
};

const CURRENT_SNAPSHOT_NAME = /\.pre-m\d+-from-m(\d+)-(\d{8}T\d{9}Z)\.bak$/;
const LEGACY_SNAPSHOT_NAME = /\.pre-m(\d+)-(\d{8}T\d{9}Z)\.bak$/;

type ParsedSnapshot = {
  readonly path: string;
  readonly baseVersion: number;
  readonly timestamp: string;
};

type ParseSnapshotParams = {
  readonly path: string;
};

const parseSnapshot = ({ path }: ParseSnapshotParams): ParsedSnapshot | null => {
  const match = path.match(CURRENT_SNAPSHOT_NAME) ?? path.match(LEGACY_SNAPSHOT_NAME);
  if (match == null) {
    return null;
  }
  return { path, baseVersion: Number(match[1]), timestamp: match[2] ?? '' };
};

type PickRestorableSnapshotParams = {
  readonly paths: ReadonlyArray<string>;
  readonly highestKnownVersion: number;
};

export const pickRestorableSnapshot = ({
  paths,
  highestKnownVersion,
}: PickRestorableSnapshotParams): string | null => {
  const restorable = paths
    .map((path) => parseSnapshot({ path }))
    .filter(
      (snapshot): snapshot is ParsedSnapshot =>
        snapshot != null && snapshot.baseVersion <= highestKnownVersion,
    )
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  return restorable[0]?.path ?? null;
};
