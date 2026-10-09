import { CONCEPT_ICONS, ICON_SIZE } from '../conceptIcons';

export const AUTO_LABEL = 'Auto';

export const AutoTriggerLabel = () => (
  <>
    <CONCEPT_ICONS.autoRouting
      size={ICON_SIZE.row}
      className="shrink-0 text-muted-foreground"
      aria-hidden
    />
    <span className="min-w-0 truncate font-medium text-foreground">{AUTO_LABEL}</span>
  </>
);
