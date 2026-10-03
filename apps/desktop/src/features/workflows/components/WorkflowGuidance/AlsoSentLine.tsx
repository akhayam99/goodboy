import { Button } from '@goodboy/ui';
import { openSettings } from '../../../settings/openSettings';

export const AlsoSentLine = () => (
  <div className="flex flex-wrap items-center gap-1.5 text-secondary text-muted-foreground">
    <span>
      Also sent to every agent:{' '}
      <span className="text-foreground">How agents should work with you</span>
    </span>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => openSettings({ scope: 'workspace', section: 'profile' })}
    >
      Edit
    </Button>
  </div>
);
