import { Button, cn } from '@goodboy/ui';
import { openSettings } from '../../settings/openSettings';
import type { ExploreOpenFailure } from '../openFailure';

type Props = {
  readonly failure: ExploreOpenFailure;
  readonly className?: string;
};

export const ExploreOpenError = ({ failure, className }: Props) => (
  <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
    <p className="text-label text-danger">{failure.message}</p>
    {failure.isEditorMissing ? (
      <Button
        size="xs"
        variant="quiet"
        onClick={() => openSettings({ scope: 'app', section: 'general' })}
      >
        Choose editor
      </Button>
    ) : null}
  </div>
);
