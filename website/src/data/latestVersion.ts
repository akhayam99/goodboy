import { compareVersions } from './compareVersions';

const VERSIONS = Object.keys(import.meta.glob('./releases/*.json')).map((path) =>
  path.replace('./releases/', '').replace('.json', ''),
);

export const LATEST_VERSION =
  [...VERSIONS].sort((left, right) => compareVersions({ left, right }))[0] ?? '';
