import rawChangelog from '../../../../../CHANGELOG.md?raw';
import { parseChangelog } from './parseChangelog';
import type { ReleaseEntry } from './parseChangelog';

export const CHANGELOG_RELEASES: ReadonlyArray<ReleaseEntry> = parseChangelog({
  text: rawChangelog,
});
