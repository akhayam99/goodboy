import { ReposScene } from '../u25/r4ReposScene';

const BEHIND = { kind: 'behind', isOpen: true } as const;

export const RepoStatusScene = () => <ReposScene config={BEHIND} />;
