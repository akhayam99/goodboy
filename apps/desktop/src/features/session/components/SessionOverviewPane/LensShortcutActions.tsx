import { Tooltip } from '@goodboy/ui';
import type { LensKind } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

const ICON_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

type Props = {
  readonly onSelectLens: (lens: LensKind) => void;
};

export const LensShortcutActions = ({ onSelectLens }: Props) => (
  <>
    <Tooltip content="Open the terminal">
      <button
        type="button"
        className={ICON_BUTTON}
        aria-label="Open the terminal"
        onClick={() => onSelectLens('terminal')}
      >
        <CONCEPT_ICONS.terminal size={13} aria-hidden />
      </button>
    </Tooltip>
    <Tooltip content="Open the scripts">
      <button
        type="button"
        className={ICON_BUTTON}
        aria-label="Open the scripts"
        onClick={() => onSelectLens('scripts')}
      >
        <CONCEPT_ICONS.scripts size={13} aria-hidden />
      </button>
    </Tooltip>
  </>
);
