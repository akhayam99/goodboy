import type { Session } from '@goodboy/types';
import { branchWorkTabRegistration } from '../../../session/branchWorkTabRegistration';
import { BranchScroll } from './BranchScroll';

type Props = {
  readonly session: Session;
  readonly work: ReturnType<typeof branchWorkTabRegistration.useWork>;
};

export const BranchWorkBody = ({ session, work }: Props) => (
  <BranchScroll sessionId={session.id} tab="work" view={null} isLoaded={work.isLoaded}>
    {branchWorkTabRegistration.render({ session, work })}
  </BranchScroll>
);
