import { Tooltip, cn } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';

type Props = {
  readonly onOpenImpact: () => void;
};

const ImpactIcon = CONCEPT_ICONS.impact;

export const ImpactButton = ({ onOpenImpact }: Props) => {
  const isCurrent = useAppStore((state) => state.appStudio?.kind === 'impact');
  const hasWorkspace = useAppStore((state) => state.currentWorkspaceId !== null);
  if (!hasWorkspace) {
    return null;
  }
  return (
    <Tooltip content="Impact" side="bottom">
      <button
        type="button"
        aria-label="Impact"
        aria-current={isCurrent ? 'page' : undefined}
        data-top-bar-impact=""
        onClick={() => {
          if (isCurrent) {
            return;
          }
          onOpenImpact();
        }}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          isCurrent
            ? 'cursor-default bg-overlay-selected text-foreground'
            : 'text-muted-foreground hover:bg-hover hover:text-foreground',
        )}
      >
        <ImpactIcon size={ICON_SIZE.control} aria-hidden />
      </button>
    </Tooltip>
  );
};
