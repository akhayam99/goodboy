import { DrawerFrame, SearchField } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useMonitorPolling } from '../../../../shared/hooks/useMonitorPolling';
import { useNow } from '../../../../shared/hooks/useNow';
import { NAMES } from '../../../../shared/utils/names';
import { useAppStore } from '../../../../store';
import { useMonitoringModel } from '../../hooks/useMonitoringModel';
import { isMonitoringEmpty } from './isMonitoringEmpty';
import { monitoringMetaOf } from './monitoringMetaOf';
import { MonitoringSections } from './MonitoringSections';
import { PinPortPopover } from './PinPortPopover';

type Props = {
  readonly onClose: () => void;
};

export const MonitoringDrawer = ({ onClose }: Props) => {
  useMonitorPolling();
  const model = useMonitoringModel();
  const setMonitoringQuery = useAppStore((state) => state.setMonitoringQuery);
  const openStudio = useAppStore((state) => state.openStudio);
  const now = useNow(5_000);
  const isReady = model.status === 'ready';
  const isEmpty = isMonitoringEmpty({ model });
  const hasRows = isReady && !isEmpty;

  return (
    <DrawerFrame
      isDock
      title={NAMES.monitoring}
      icon={CONCEPT_ICONS.monitoring}
      meta={monitoringMetaOf({
        isReady,
        isEmpty,
        summary: model.summary,
        takenAt: model.takenAt,
        now,
      })}
      action={hasRows ? <PinPortPopover isIcon /> : null}
      toolbar={
        hasRows ? (
          <SearchField
            ariaLabel={NAMES.searchPorts}
            placeholder={NAMES.searchPorts}
            value={model.query}
            onChange={(query) => setMonitoringQuery({ workspaceId: model.workspaceId, query })}
          />
        ) : null
      }
      page={{
        label: NAMES.openFullPage,
        onOpen: () => openStudio({ studio: { kind: 'monitoring' } }),
      }}
      onClose={onClose}
      scroll="self"
    >
      <div data-testid="monitoring-panel" className="flex min-h-0 flex-1 flex-col px-2">
        <MonitoringSections model={model} memoryPrefix="monitoring-panel" />
      </div>
    </DrawerFrame>
  );
};
