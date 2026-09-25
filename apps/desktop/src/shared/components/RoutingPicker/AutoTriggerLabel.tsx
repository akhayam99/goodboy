import { CONCEPT_ICONS } from '../conceptIcons';

export const AUTO_LABEL = 'Auto';

export const AutoTriggerLabel = () => (
  <>
    <CONCEPT_ICONS.autoRouting size={12} className="shrink-0 text-muted-foreground" aria-hidden />
    <span className="min-w-0 truncate font-medium text-foreground">{AUTO_LABEL}</span>
  </>
);
