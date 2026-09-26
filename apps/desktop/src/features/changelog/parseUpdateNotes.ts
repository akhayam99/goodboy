import { parseChangelog } from './parseChangelog';
import type { ReleaseEntry } from './parseChangelog';

type Params = {
  readonly version: string;
  readonly body: string;
};

export const parseUpdateNotes = ({ version, body }: Params): ReleaseEntry | null => {
  if (body.trim() === '') {
    return null;
  }
  const heading = `## Goodboy v${version}`;
  const releases = parseChangelog({ text: `${heading}\n\n${body}` });
  return releases[0] ?? null;
};
