import { Activity } from 'lucide-react';
import { EmptyState, HeaderActions, PaneShell, ScrollFade, SearchField } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { useIdleCounts } from '../../hooks/useIdleCounts';
import { useLeftoverRows } from '../../hooks/useLeftoverRows';
import { useMonitoringModel } from '../../hooks/useMonitoringModel';
import { useMonitorPolling } from '../../hooks/useMonitorPolling';
import { summaryMeta } from '../../summaryMeta';
import { GoodboySection } from './GoodboySection';
import { HiddenFooter } from './HiddenFooter';
import { ListeningSection } from './ListeningSection';
import { MonitoringSkeleton } from './MonitoringSkeleton';
import { PinnedSection } from './PinnedSection';
import { PinPortPopover } from './PinPortPopover';
import { ReadFailedNotice } from './ReadFailedNotice';
import { WorkspaceSection } from './WorkspaceSection';

export const MonitoringPage = () => {
  useMonitorPolling();
  const model = useMonitoringModel();
  const now = useNow(5_000);
  const leftovers = useLeftoverRows();
  const idleCounts = useIdleCounts();
  const sweptCount = useAppStore((state) => state.monitorSweptCount);
  const isReady = model.status === 'ready';
  const isEmpty = isReady && model.query === '' && model.isTrackedEmpty;
  const hasGoodboy = model.goodboy.length > 0 || model.processes.length > 0 || leftovers.length > 0;

  return (
    <PaneShell
      scroll="body"
      title="Monitoring"
      meta={
        isReady ? summaryMeta({ summary: model.summary, takenAt: model.takenAt, now }) : undefined
      }
      actions={
        <HeaderActions
          secondary={
            isReady ? (
              <SearchField
                ariaLabel="Filter ports"
                placeholder="Port or project"
                value={model.query}
                onChange={model.setQuery}
                className="w-56"
              />
            ) : null
          }
          primary={isReady && !isEmpty ? <PinPortPopover variant="primary" /> : null}
        />
      }
    >
      <ScrollFade viewportClassName="flex flex-col gap-6 pb-6">
        {model.status === 'loading' ? <MonitoringSkeleton /> : null}
        {model.status === 'failed' ? <ReadFailedNotice tone="danger" detail={model.error} /> : null}
        {model.status === 'unsupported' ? (
          <EmptyState icon={Activity} title="Monitoring needs macOS or Linux." />
        ) : null}
        {isReady && model.error !== null ? (
          <ReadFailedNotice tone="warning" detail={model.error} />
        ) : null}
        {isEmpty ? (
          <EmptyState
            icon={Activity}
            title="Goodboy found no ports in your projects"
            action={<PinPortPopover variant="primary" />}
          />
        ) : null}
        {isReady && model.pinned.length > 0 ? (
          <PinnedSection rows={model.pinned} processOf={model.processOf} now={now} />
        ) : null}
        {isReady && hasGoodboy ? (
          <GoodboySection
            rows={model.goodboy}
            processes={model.processes}
            leftovers={leftovers}
            sweptCount={sweptCount}
            idleCounts={idleCounts}
            processOf={model.processOf}
            now={now}
          />
        ) : null}
        {isReady && model.workspace.length > 0 ? (
          <WorkspaceSection rows={model.workspace} processOf={model.processOf} now={now} />
        ) : null}
        {isReady && model.listening.length > 0 ? (
          <ListeningSection
            rows={model.listening}
            processOf={model.processOf}
            now={now}
            isForcedOpen={model.query !== ''}
          />
        ) : null}
        {isReady && model.hiddenCount > 0 ? <HiddenFooter count={model.hiddenCount} /> : null}
      </ScrollFade>
    </PaneShell>
  );
};
