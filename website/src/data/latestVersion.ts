import { compareVersions } from '../lib/compareVersions';

export const SNAPSHOT_VERSIONS = Object.keys(import.meta.glob('./releases/*.json')).map((path) =>
  path.replace('./releases/', '').replace('.json', ''),
);

export const LATEST_VERSION =
  [...SNAPSHOT_VERSIONS].sort((left, right) => compareVersions({ left, right }))[0] ?? '';
