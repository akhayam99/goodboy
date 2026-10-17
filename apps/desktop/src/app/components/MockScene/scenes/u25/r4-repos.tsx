import { ReposScene } from './r4ReposScene';

const BEHIND = { kind: 'behind', isOpen: true } as const;
const DIRTY = { kind: 'dirty', isOpen: true } as const;
const FAILED = { kind: 'failed', isOpen: true } as const;
const QUIET = { kind: 'quiet', isOpen: false } as const;
const CLOSED = { kind: 'behind', isOpen: false } as const;

export const U25_R4_REPOS_SCENES = {
  'r4-repos-behind': () => <ReposScene config={BEHIND} />,
  'r4-repos-closed': () => <ReposScene config={CLOSED} />,
  'r4-repos-dirty': () => <ReposScene config={DIRTY} />,
  'r4-repos-failed': () => <ReposScene config={FAILED} />,
  'r4-repos-quiet': () => <ReposScene config={QUIET} />,
};
