import { X } from 'lucide-react';
import { finish } from '../onboarding-store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { IconButton } from '@goodboy/ui';

export const CompletedBody = () => (
  <>
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1 text-eyebrow text-success">
        <CONCEPT_ICONS.decisions size={ICON_SIZE.mark} aria-hidden />
        Setup complete
      </span>
      <IconButton icon={X} label="Dismiss onboarding" size="xs" onClick={() => finish()} />
    </div>
    <p className="text-meta text-muted-foreground">That was the last step. Setup is complete.</p>
  </>
);
