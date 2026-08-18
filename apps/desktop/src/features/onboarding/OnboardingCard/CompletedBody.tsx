import { X } from 'lucide-react';
import { finish } from '../onboarding-store';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { Tooltip } from '@goodboy/ui';

export const CompletedBody = () => (
  <>
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.08em] text-success">
        <CONCEPT_ICONS.decisions size={11} aria-hidden />
        Setup complete
      </span>
      <Tooltip content="Dismiss onboarding">
        <button
          type="button"
          onClick={() => finish()}
          aria-label="Dismiss onboarding"
          className="rounded-md p-0.5 text-muted-foreground/70 motion-safe:transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X size={11} aria-hidden />
        </button>
      </Tooltip>
    </div>
    <p className="text-2xs leading-snug text-muted-foreground/80">
      That was the last step. Setup is complete.
    </p>
  </>
);
