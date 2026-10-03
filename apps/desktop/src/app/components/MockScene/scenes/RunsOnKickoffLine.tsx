import type { WorkspaceId } from '@goodboy/types';
import { RunsOn } from '../../../../shared/components/RunsOn';
import { useWorkspaceKindRouting } from '../../../../shared/hooks/useWorkspaceKindRouting';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const RunsOnKickoffLine = ({ workspaceId }: Props) => {
  const suggested = useWorkspaceKindRouting({ workspaceId, kind: 'implementer' });
  return <RunsOn suggested={suggested} override={null} onChange={() => undefined} />;
};
