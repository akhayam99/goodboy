import { PaneShell, SearchField } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { NAMES } from '../../../../shared/utils/names';
import { useMonitoringModel } from '../../hooks/useMonitoringModel';
import { useMonitorPolling } from '../../../../shared/hooks/useMonitorPolling';
import { isMonitoringEmpty } from './isMonitoringEmpty';
import { monitoringMetaOf } from './monitoringMetaOf';
import { MonitoringSections } from './MonitoringSections';
import { PinPortPopover } from './PinPortPopover';

export const MonitoringPage = () => {
  useMonitorPolling();
  const model = useMonitoringModel();
  const setMonitoringQuery = useAppStore((state) => state.setMonitoringQuery);
  const now = useNow(5_000);
  const isReady = model.status === 'ready';
  const isEmpty = isMonitoringEmpty({ model });
  const hasRows = isReady && !isEmpty;

  return (
    <PaneShell
      page="monitoring"
      scroll="body"
      title={NAMES.monitoring}
      meta={monitoringMetaOf({
        isReady,
        isEmpty,
        summary: model.summary,
        takenAt: model.takenAt,
        now,
      })}
      actions={hasRows ? <PinPortPopover /> : null}
      toolbar={
        hasRows ? (
          <SearchField
            ariaLabel={NAMES.searchPorts}
            placeholder={NAMES.searchPorts}
            value={model.query}
            onChange={(query) => setMonitoringQuery({ workspaceId: model.workspaceId, query })}
            className="w-56"
          />
        ) : null
      }
    >
      <MonitoringSections model={model} memoryPrefix="monitoring" />
    </PaneShell>
  );
};
