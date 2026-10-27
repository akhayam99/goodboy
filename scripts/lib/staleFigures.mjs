const RELEASE_HEADING = /^## Goodboy v(\d+\.\d+\.\d+)\s*$/;
const AREA_META = /<!-- gb area=([a-z-]+)/;
const GUIDE_PATH = /^docs\/features\/([a-z-]+)\.md$/;

export const AREA_GUIDES = {
  agents: ['agents'],
  artifacts: ['artifacts'],
  inbox: ['inbox'],
  providers: ['providers'],
  review: ['review'],
  sessions: ['overview', 'board', 'switching'],
  settings: ['setup', 'security'],
  storage: ['storage'],
  workflows: ['workflows'],
};

const compareVersions = ({ left, right }) => {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
};

export const newestChangeByGuide = ({ changelog }) => {
  const newest = {};
  let version = null;
  for (const line of changelog.split('\n')) {
    const heading = RELEASE_HEADING.exec(line)?.[1];
    if (heading !== undefined) {
      version = heading;
      continue;
    }
    const area = AREA_META.exec(line)?.[1];
    if (version === null || area === undefined) {
      continue;
    }
    for (const guide of AREA_GUIDES[area] ?? []) {
      if (
        newest[guide] === undefined ||
        compareVersions({ left: version, right: newest[guide].version }) > 0
      ) {
        newest[guide] = { version, area };
      }
    }
  }
  return newest;
};

export const staleFiguresOf = ({ figures, pictureKeys, changelog }) => {
  const newest = newestChangeByGuide({ changelog });
  const stale = [];
  for (const { path, keys } of pictureKeys) {
    const guide = GUIDE_PATH.exec(path)?.[1];
    const change = guide === undefined ? undefined : newest[guide];
    if (change === undefined) {
      continue;
    }
    for (const key of keys) {
      const version = figures[key]?.version;
      if (version === undefined || compareVersions({ left: version, right: change.version }) >= 0) {
        continue;
      }
      stale.push({ key, guide, version, area: change.area, newest: change.version });
    }
  }
  return stale;
};
