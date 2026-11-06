import type { Session } from '@goodboy/types';
import { StartRun } from '../StartRun/StartRun';

type Props = {
  readonly session: Session;
};

const PLACEHOLDER = 'What should it do?';

const HINT = 'Describe what you want done. Goodboy opens a branch for it.';

export const EmptySessionStart = ({ session }: Props) => (
  <StartRun
    workspaceId={session.workspaceId}
    sessionId={session.id}
    placeholder={PLACEHOLDER}
    hint={HINT}
  />
);
