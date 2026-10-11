import { Activity } from 'lucide-react';
import type { PortRow } from '@goodboy/core';
import {
  Button,
  EmptyState,
  HeaderActions,
  Notice,
  PaneShell,
  ScrollFade,
  SearchField,
} from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { defaultProjectId } from '../../defaultProjectId';
import { useMonitoringModel } from '../../hooks/useMonitoringModel';
import { useMonitorPolling } from '../../hooks/useMonitorPolling';
import { summaryMeta } from '../../summaryMeta';
import { AlsoListeningSection } from './AlsoListeningSection';
import { MonitoringSkeleton } from './MonitoringSkeleton';
import { PortsSection } from './PortsSection';
import { StartedSection } from './StartedSection';
import { WatchPortPopover } from './WatchPortPopover';

export const MonitoringPage = () => {
  useMonitorPolling();
  const model = useMonitoringModel();
  const now = useNow(5_000);
  const refresh = useAppStore((state) => state.refreshMonitorSnapshot);
  const watchPort = useAppStore((state) => state.watchPort);
  const fallbackProjectId = defaultProjectId({ projects: model.projects });
  const isReady = model.status === 'ready';
  const isEmpty = isReady && model.query === '' && model.ports.length === 0;

  const watchListening = (row: PortRow) => {
    const projectId = row.projectId ?? fallbackProjectId;
    if (projectId === null) {
      return;
    }
    void watchPort({ projectId, port: row.port });
  };

  const watchButton =
    isReady && !isEmpty ? (
      <WatchPortPopover
        projects={model.projects}
        defaultProjectId={fallbackProjectId}
        variant="primary"
      />
    ) : null;

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
          primary={watchButton}
        />
      }
    >
      <ScrollFade viewportClassName="flex flex-col gap-6 pb-6">
        {model.status === 'loading' ? <MonitoringSkeleton /> : null}
        {model.status === 'failed' ? (
          <Notice
            tone="danger"
            placement="inline"
            role="alert"
            title="Couldn't read ports"
            detail={model.error}
            actions={
              <Button size="sm" variant="secondary" onClick={() => void refresh()}>
                Retry
              </Button>
            }
          />
        ) : null}
        {model.status === 'unsupported' ? (
          <EmptyState icon={Activity} title="Monitoring needs macOS or Linux." />
        ) : null}
        {isReady && model.error !== null ? (
          <Notice
            tone="warning"
            placement="inline"
            role="alert"
            title="Couldn't read ports"
            detail={model.error}
            actions={
              <Button size="sm" variant="secondary" onClick={() => void refresh()}>
                Retry
              </Button>
            }
          />
        ) : null}
        {isEmpty ? (
          <EmptyState
            icon={Activity}
            title="Goodboy found no ports in your projects"
            action={
              <WatchPortPopover
                projects={model.projects}
                defaultProjectId={fallbackProjectId}
                variant="primary"
              />
            }
          />
        ) : null}
        {isReady && model.ports.length > 0 ? (
          <PortsSection rows={model.ports} processOf={model.processOf} now={now} />
        ) : null}
        {isReady && model.started.length > 0 ? (
          <StartedSection rows={model.started} now={now} />
        ) : null}
        {isReady && model.also.length > 0 ? (
          <AlsoListeningSection
            rows={model.also}
            processOf={model.processOf}
            now={now}
            isForcedOpen={model.query !== ''}
            onWatch={watchListening}
          />
        ) : null}
      </ScrollFade>
    </PaneShell>
  );
};
