import { useEffect, useMemo, useState } from 'react';
import { IconButton, StudioRailLayout } from '@goodboy/ui';
import { RefreshCw } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useInboxRecords } from '../../useInboxRecords';
import { INBOX_PROVIDERS, type InboxKind, type InboxProvider, type InboxRecord } from '../../types';
import { filterInboxRecords, type InboxKindFilter } from '../../kindFilter';
import { readInboxKindFilter, writeInboxKindFilter } from '../../kindFilterStorage';
import { InboxDetail } from './InboxDetail';
import { InboxRail } from './InboxRail';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly workspaceName: string;
  readonly initialProvider?: InboxProvider | null;
  readonly initialKind?: InboxKind | null;
  readonly initialRecordKey?: string | null;
  readonly onClose: () => void;
};

const kindToFilter = (kind: InboxKind): InboxKindFilter => {
  switch (kind) {
    case 'issue':
      return 'issue';
    case 'pr':
    case 'mr':
      return 'pr-mr';
    case 'thread':
      return 'thread';
    case 'error':
      return 'error';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

export const InboxStudio = ({
  workspaceId,
  rootPath,
  workspaceName,
  initialProvider = null,
  initialKind = null,
  initialRecordKey = null,
  onClose,
}: Props) => {
  const { records, isLoading, errors, refetch } = useInboxRecords({ workspaceId, rootPath });
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<InboxKindFilter>(() => {
    if (initialKind != null) {
      return kindToFilter(initialKind);
    }
    return readInboxKindFilter({ workspaceId }) ?? 'all';
  });
  const [selectedProviders, setSelectedProviders] = useState<ReadonlySet<InboxProvider>>(() =>
    initialProvider != null ? new Set([initialProvider]) : new Set(),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(initialRecordKey);

  useEffect(() => {
    writeInboxKindFilter({ workspaceId, kindFilter });
  }, [workspaceId, kindFilter]);

  const availableProviders = useMemo(() => {
    const present = new Set(records.map((record) => record.provider));
    return INBOX_PROVIDERS.filter((provider) => present.has(provider));
  }, [records]);

  const filteredRecords = useMemo(
    () => filterInboxRecords({ records, query, kindFilter, providers: selectedProviders }),
    [records, query, kindFilter, selectedProviders],
  );

  const selectedRecord = useMemo(
    () => records.find((record) => record.key === selectedKey) ?? null,
    [records, selectedKey],
  );

  const onSelect = (record: InboxRecord): void => {
    setSelectedKey(record.key);
  };

  const onToggleProvider = (provider: InboxProvider): void => {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
        return next;
      }
      next.add(provider);
      return next;
    });
  };

  const onClearFilters = (): void => {
    setQuery('');
    setKindFilter('all');
    setSelectedProviders(new Set());
  };

  const onOpenIntegrations = (): void => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-settings', { detail: { scope: 'providers' } }),
    );
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.inbox}
      tone={CONCEPT_TONE.inbox}
      title="Inbox"
      workspaceName={workspaceName}
      closeLabel="close inbox studio"
      headerAccessory={
        <IconButton
          icon={RefreshCw}
          label="Refresh inbox"
          onClick={refetch}
          disabled={isLoading}
          busy={isLoading}
        />
      }
      onClose={onClose}
    >
      {(requestClose) => (
        <StudioRailLayout
          railLabel="Inbox"
          railWidth="standard"
          rail={
            <InboxRail
              records={filteredRecords}
              totalCount={records.length}
              allRecords={records}
              availableProviders={availableProviders}
              selectedProviders={selectedProviders}
              onToggleProvider={onToggleProvider}
              query={query}
              onQueryChange={setQuery}
              kindFilter={kindFilter}
              onKindFilterChange={setKindFilter}
              selectedKey={selectedKey}
              onSelect={onSelect}
              isLoading={isLoading}
              errors={INBOX_PROVIDERS.flatMap((provider) => {
                const message = errors[provider];
                return message == null ? [] : [{ provider, message }];
              })}
              onRefresh={refetch}
              onOpenIntegrations={onOpenIntegrations}
              onClearFilters={onClearFilters}
            />
          }
          detail={
            <InboxDetail
              record={selectedRecord}
              workspaceId={workspaceId}
              rootPath={rootPath}
              isLoading={isLoading}
              errors={errors}
              onRefresh={refetch}
              onClose={requestClose}
            />
          }
        />
      )}
    </StudioShell>
  );
};
