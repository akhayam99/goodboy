import { ArrowRight } from '@goodboy/ui/icons';
import { ICON_SIZE, InteractiveRow, cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import { openConnection } from '../../../connections/openConnection';

const ConnectionsIcon = CONCEPT_ICONS.connections;

export const MovedToConnectionsRow = () => (
  <InteractiveRow
    label={`Open ${NAMES.connections}`}
    isSelected={false}
    onOpen={() => openConnection({ focus: null })}
    radius="lg"
    frameClassName="border border-border-soft"
    className="flex min-w-0 items-center gap-2 p-2"
    dataAttributes={{ 'data-settings-moved': 'connections' }}
  >
    <ConnectionsIcon
      size={ICON_SIZE.row}
      aria-hidden
      className={cn('shrink-0', tintClasses(CONCEPT_TONE.connections).icon)}
    />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-row text-foreground">{`Moved to ${NAMES.connections}`}</span>
      <span className="truncate text-meta text-muted-foreground">Providers and integrations</span>
    </span>
    <ArrowRight size={ICON_SIZE.row} aria-hidden className="shrink-0" />
  </InteractiveRow>
);
