import { EmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import { CreateMrForm } from '../../../integrations/gitlab/MergeRequest/MrDetailPanel/CreateMrForm';

type Props = {
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
  readonly onCreated: () => void;
};

export const NoMergeRequest = ({ sessionId, mountPath, onCreated }: Props) => {
  const branch = useAppStore((state) =>
    mountPath === null
      ? null
      : (selectMountForPath({ state, sessionId, path: mountPath })?.branch ?? null),
  );
  const mountId = useAppStore((state) =>
    mountPath === null
      ? null
      : (selectMountForPath({ state, sessionId, path: mountPath })?.mountId ?? null),
  );
  const error = useAppStore((state) =>
    mountId === null ? null : (state.mountGitlabMr?.[mountId]?.error ?? null),
  );
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4">
      <EmptyState
        size="page"
        icon={CONCEPT_ICONS.pr}
        title="No merge request yet"
        description="Comments live on the merge request. Create it here."
      />
      <CreateMrForm sessionId={sessionId} branch={branch} error={error} onClose={onCreated} />
    </div>
  );
};
