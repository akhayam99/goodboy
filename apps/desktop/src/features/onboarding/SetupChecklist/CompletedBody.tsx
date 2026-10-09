import { X } from 'lucide-react';
import { finish } from '../onboarding-store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { Tooltip } from '@goodboy/ui';

export const CompletedBody = () => (
  <>
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1 text-eyebrow text-success">
        <CONCEPT_ICONS.decisions size={ICON_SIZE.mark} aria-hidden />
        Setup complete
      </span>
      <Tooltip content="Dismiss onboarding">
        <button
          type="button"
          onClick={() => finish()}
          aria-label="Dismiss onboarding"
          className="rounded-md p-0.5 text-faint-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground"
        >
          <X size={ICON_SIZE.row} aria-hidden />
        </button>
      </Tooltip>
    </div>
    <p className="text-meta text-muted-foreground">That was the last step. Setup is complete.</p>
  </>
);
