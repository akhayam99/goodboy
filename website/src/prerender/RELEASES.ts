import changelog from '../../../CHANGELOG.md?raw';
import { compareVersions } from '../data/compareVersions';

type ReleaseSnapshot = {
  readonly version: string;
  readonly date: string;
  readonly summary: string;
};

export type Release = ReleaseSnapshot & {
  readonly notes: string;
};

const SNAPSHOTS = import.meta.glob<ReleaseSnapshot>('../data/releases/*.json', {
  eager: true,
  import: 'default',
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const notesOf = (version: string) => {
  const lines = changelog.split('\n');
  const start = lines.indexOf(`## Goodboy v${version}`);
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no "## Goodboy v${version}" entry`);
  }
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  const body = lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim();
  const firstBreak = body.indexOf('\n\n');
  return firstBreak === -1 ? '' : body.slice(firstBreak).trim();
};

const toRelease = (snapshot: ReleaseSnapshot): Release => {
  if (!DATE.test(snapshot.date ?? '')) {
    throw new Error(`release snapshot ${snapshot.version} has no date`);
  }
  return {
    version: snapshot.version,
    date: snapshot.date,
    summary: snapshot.summary,
    notes: notesOf(snapshot.version),
  };
};

export const RELEASES: readonly Release[] = Object.values(SNAPSHOTS)
  .map(toRelease)
  .sort((left, right) => compareVersions({ left: left.version, right: right.version }));
