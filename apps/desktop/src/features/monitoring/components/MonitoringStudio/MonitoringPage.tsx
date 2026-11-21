import { useCallback, useRef } from 'react';
import { PaneShell, SearchField } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useRowFocusKeys } from '../../../../shared/hooks/useRowFocusKeys';
import { useNow } from '../../../../shared/hooks/useNow';
import { NAMES } from '../../../../shared/utils/names';
import { useMonitoringModel } from '../../hooks/useMonitoringModel';
import { useMonitorPolling } from '../../../../shared/hooks/useMonitorPolling';
import { isMonitoringEmpty } from './isMonitoringEmpty';
import { monitoringMetaOf } from './monitoringMetaOf';
import { MonitoringSections } from './MonitoringSections';
import { PinPortPopover } from './PinPortPopover';

const MONITORING_ROW = '[data-port-row], [data-started-row], [data-shared-pid]';

export const MonitoringPage = () => {
  useMonitorPolling();
  const model = useMonitoringModel();
  const setMonitoringQuery = useAppStore((state) => state.setMonitoringQuery);
  const now = useNow(5_000);
  const isReady = model.status === 'ready';
  const isEmpty = isMonitoringEmpty({ model });
  const hasRows = isReady && !isEmpty;
  const pageRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useRowFocusKeys({
    containerRef: pageRef,
    rowSelector: MONITORING_ROW,
    ...(hasRows && { onSearch: focusSearch }),
  });

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
            inputRef={searchRef}
            ariaLabel={NAMES.searchPorts}
            placeholder={NAMES.searchPorts}
            value={model.query}
            onChange={(query) => setMonitoringQuery({ workspaceId: model.workspaceId, query })}
            className="w-56"
          />
        ) : null
      }
    >
      <div ref={pageRef} className="contents">
        <MonitoringSections model={model} memoryPrefix="monitoring" />
      </div>
    </PaneShell>
  );
};
