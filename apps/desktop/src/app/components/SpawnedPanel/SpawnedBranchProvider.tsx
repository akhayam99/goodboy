import type { ReactNode } from 'react';
import type { Session } from '@goodboy/types';
import { useAgentBranchLabels } from '../../../features/session/hooks/useAgentBranchLabels';
import { SpawnedBranchContext } from './spawnedBranchContext';

type Props = {
  readonly session: Session;
  readonly children: ReactNode;
};

export const SpawnedBranchProvider = ({ session, children }: Props) => {
  const labels = useAgentBranchLabels({ session });
  return <SpawnedBranchContext.Provider value={labels}>{children}</SpawnedBranchContext.Provider>;
};
