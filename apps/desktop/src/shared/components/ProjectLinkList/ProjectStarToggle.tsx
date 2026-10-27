import { StarToggle } from '@goodboy/ui';
import type { Project } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { NOTHING_CHANGED } from '../../../store/slices/notifications/errorRecovery';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
};

export const ProjectStarToggle = ({ project, busy }: Props) => {
  const setProjectStarred = useAppStore((state) => state.setProjectStarred);
  const reportError = useAppStore((state) => state.reportError);
  const isStarred = project.starredAt !== undefined;

  const toggle = async () => {
    try {
      await setProjectStarred({ projectId: project.id, isStarred: !isStarred });
    } catch (error) {
      void reportError({
        title: `Couldn't update ${project.name}`,
        error,
        recovery: NOTHING_CHANGED,
      });
    }
  };

  return (
    <StarToggle
      isStarred={isStarred}
      label={`Starred: ${project.name}`}
      tooltip="Starred folders come first for agents"
      disabled={busy}
      onToggle={() => void toggle()}
    />
  );
};
