import { Button, StatusDot, Tooltip, cn } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { useDoorSignals } from '../SideColumn/useDoorSignals';

const MonitoringIcon = CONCEPT_ICONS.monitoring;

export const MonitoringSignal = () => {
  const signal = useDoorSignals({}).monitoring;
  const isOpen = useAppStore((state) => state.appStudio?.kind === 'monitoring');
  const switchStudio = useAppStore((state) => state.switchStudio);
  const isDown = signal?.isWarning === true;
  const label = signal === undefined ? 'Monitoring' : `Monitoring, ${signal.fact}`;

  return (
    <Tooltip content={label}>
      <Button
        variant="quiet"
        size="sm"
        data-monitoring-signal={isDown ? 'warning' : signal === undefined ? 'quiet' : 'busy'}
        aria-label={label}
        aria-pressed={isOpen}
        onClick={() => switchStudio({ studio: { kind: 'monitoring' } })}
        className={cn('px-2', isOpen && 'bg-selected text-foreground')}
      >
        <MonitoringIcon size={ICON_SIZE.row} aria-hidden />
        {signal === undefined ? null : <StatusDot tone={isDown ? 'warning' : 'info'} size="sm" />}
        {isDown ? <span>Pinned port down</span> : null}
      </Button>
    </Tooltip>
  );
};
