import { EmptyState, HeaderActions, PaneShell, ScrollFade, SearchField } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { useIdleCounts } from '../../hooks/useIdleCounts';
import { useLeftoverRows } from '../../hooks/useLeftoverRows';
import { useMonitoringModel } from '../../hooks/useMonitoringModel';
import { useMonitorPolling } from '../../../../shared/hooks/useMonitorPolling';
import type { PortSummary } from '../../portSummary';
import { summaryMeta } from '../../summaryMeta';
import { ColumnHeader } from './ColumnHeader';
import { GoodboySection } from './GoodboySection';
import { HiddenFooter } from './HiddenFooter';
import { ListeningSection } from './ListeningSection';
import { MonitoringSkeleton } from './MonitoringSkeleton';
import { PinnedSection } from './PinnedSection';
import { PinPortPopover } from './PinPortPopover';
import { ReadFailedNotice } from './ReadFailedNotice';
import { WorkspaceSection } from './WorkspaceSection';

type MetaParams = {
  readonly isReady: boolean;
  readonly isEmpty: boolean;
  readonly summary: PortSummary;
  readonly takenAt: number | null;
  readonly now: number;
};

const metaOf = ({ isReady, isEmpty, summary, takenAt, now }: MetaParams): string | undefined => {
  if (!isReady) {
    return undefined;
  }
  if (isEmpty) {
    return 'Nothing tracked';
  }
  return summaryMeta({ summary, takenAt, now }) ?? undefined;
};

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
      page="monitoring"
      scroll="body"
      title="Monitoring"
      meta={metaOf({ isReady, isEmpty, summary: model.summary, takenAt: model.takenAt, now })}
      actions={
        <HeaderActions
          secondary={
            isReady && !isEmpty ? (
              <SearchField
                ariaLabel="Filter ports"
                placeholder="Port or folder"
                value={model.query}
                onChange={model.setQuery}
                className="w-56"
              />
            ) : null
          }
          button={isReady && !isEmpty ? <PinPortPopover /> : null}
        />
      }
    >
      <ScrollFade viewportClassName="flex flex-col gap-6 pb-6">
        {model.status === 'loading' ? <MonitoringSkeleton /> : null}
        {model.status === 'failed' ? <ReadFailedNotice tone="danger" detail={model.error} /> : null}
        {model.status === 'unsupported' ? (
          <EmptyState
            icon={CONCEPT_ICONS.monitoring}
            tone={CONCEPT_TONE.monitoring}
            title="Monitoring needs macOS or Linux."
          />
        ) : null}
        {isReady && model.error !== null ? (
          <ReadFailedNotice tone="warning" detail={model.error} />
        ) : null}
        {isEmpty ? (
          <EmptyState
            icon={CONCEPT_ICONS.monitoring}
            tone={CONCEPT_TONE.monitoring}
            title="No ports in use"
            description="Ports opened by agents, terminals and scripts are listed with their process."
            action={<PinPortPopover align="start" />}
            size="page"
            headingLevel={2}
          />
        ) : null}
        {isReady && !isEmpty ? <ColumnHeader /> : null}
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
