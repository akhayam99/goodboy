import { PANE_RHYTHM, cn } from '@goodboy/ui';
import { isDirectedScene } from '../../../shared/utils/isDirectedScene';
import { useOnboardingProgress } from '../hooks/useOnboardingProgress';
import { SetupSection } from '../SetupChecklist/SetupSection';

type Props = {
  readonly isMainWindow: boolean;
};

const stayOpen = (): void => undefined;

export const SetupCard = ({ isMainWindow }: Props) => {
  const progress = useOnboardingProgress();
  if (isDirectedScene() || progress.isFinished || !progress.hasProjects) {
    return null;
  }
  return (
    <div
      data-slot="setup-card"
      data-rhythm="section"
      className={cn('shrink-0', PANE_RHYTHM.below.section)}
    >
      <div className="rounded-lg bg-subtle py-2">
        <SetupSection progress={progress} isMainWindow={isMainWindow} onLeave={stayOpen} />
      </div>
    </div>
  );
};
