import { useRef } from 'react';
import {
  EmptyState,
  HeaderActions,
  PaneShell,
  ScrollFade,
  SearchField,
  useScrollMemory,
} from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { useIdleCounts } from '../../hooks/useIdleCounts';
import { useMonitoringModel } from '../../hooks/useMonitoringModel';
import { useMonitorPolling } from '../../../../shared/hooks/useMonitorPolling';
import { monitoringTargetKey } from '../../monitoringTarget';
import type { PortSummary } from '../../portSummary';
import { summaryMeta } from '../../summaryMeta';
import { BranchFilterChip } from './BranchFilterChip';
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
  const setMonitoringQuery = useAppStore((state) => state.setMonitoringQuery);
  const now = useNow(5_000);
  const idleCounts = useIdleCounts();
  const sweptCount = useAppStore((state) => state.monitorSweptCount);
  const isReady = model.status === 'ready';
  const leftovers = model.leftovers;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const onScroll = useScrollMemory({
    memoryKey: `monitoring:${model.workspaceId}:${monitoringTargetKey({ target: model.target })}`,
    isLoaded: isReady,
    viewportRef,
  });
  const isEmpty = isReady && model.query === '' && model.isTrackedEmpty && model.target === null;
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
                onChange={(query) => setMonitoringQuery({ workspaceId: model.workspaceId, query })}
                className="w-56"
              />
            ) : null
          }
          button={isReady && !isEmpty ? <PinPortPopover /> : null}
        />
      }
    >
      <ScrollFade
        viewportClassName="flex flex-col gap-6 pb-6"
        viewportRef={viewportRef}
        onViewportScroll={onScroll}
      >
        {model.target === null ? null : <BranchFilterChip branch={model.target.branch} />}
        {isReady && model.isBranchEmpty ? (
          <EmptyState
            icon={CONCEPT_ICONS.monitoring}
            tone={CONCEPT_TONE.monitoring}
            title="Nothing running on this branch"
            description="Ports and processes started from this branch show here."
            size="page"
            headingLevel={2}
          />
        ) : null}
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
        {isReady && !isEmpty && !model.isBranchEmpty ? <ColumnHeader /> : null}
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
