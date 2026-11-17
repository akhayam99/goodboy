import { HeaderActions, PaneShell, SearchField } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
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

  return (
    <PaneShell
      page="monitoring"
      scroll="body"
      title="Monitoring"
      meta={monitoringMetaOf({
        isReady,
        isEmpty,
        summary: model.summary,
        takenAt: model.takenAt,
        now,
      })}
      actions={
        <HeaderActions
          secondary={
            isReady && !isEmpty ? (
              <SearchField
                ariaLabel="Filter ports"
                placeholder="Port or folder"
                value={model.query}
                onChange={(query) => setMonitoringQuery({ workspaceId: model.workspaceId, query })}
                className="w-56"
              />
            ) : null
          }
          button={isReady && !isEmpty ? <PinPortPopover /> : null}
        />
      }
    >
      <MonitoringSections model={model} memoryPrefix="monitoring" />
    </PaneShell>
  );
};
