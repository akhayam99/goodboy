import { Button } from '@goodboy/ui';
import { openSettings } from '../../../settings/openSettings';
import { workingRulesSkippedText } from '../../guidanceRoles';

export const AlsoSentLine = () => (
  <div className="flex flex-wrap items-center gap-1.5 text-secondary text-muted-foreground">
    <span>
      Also sent to {workingRulesSkippedText()}:{' '}
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
