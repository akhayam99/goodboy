import { ListGridGroup, ListGridLine } from '@goodboy/ui';
import type { WorkspaceIssueLookup } from '../../../integrations/hooks/useWorkspaceIssueLookup';
import type { LookupHit } from '../../../integrations/issueCode/lookupIssueByCode';
import { lookingUpText, lookupStatuses } from '../../../integrations/issueCode/lookupCopy';
import { openToolSettings } from '../../../integrations/openToolSettings';
import { InboxRow, inboxOptionId } from './InboxRow';
import type { InboxRecord } from '../../types';
import { LookupStatusRow } from './LookupStatusRow';

type Props = {
  readonly lookup: WorkspaceIssueLookup;
  readonly workspaceName: string;
  readonly selectedKey: string | null;
  readonly cursorKey?: string | null;
  readonly onSelect: (hit: LookupHit) => void;
  readonly onActivate?: (record: InboxRecord) => void;
  readonly starOf?: (record: InboxRecord) => boolean | undefined;
  readonly onToggleStar?: (record: InboxRecord) => void;
};

export const InboxLookupGroup = ({
  lookup,
  workspaceName,
  selectedKey,
  cursorKey,
  onSelect,
  onActivate,
  starOf,
  onToggleStar,
}: Props) => {
  const { state, code } = lookup;
  if (state.status === 'idle' || code === null) {
    return null;
  }
  const statuses =
    state.status === 'done' ? lookupStatuses({ lookup: state.value, workspaceName }) : [];
  const hits = state.status === 'done' ? state.value.result.hits : [];
  if (state.status === 'done' && hits.length === 0 && statuses.length === 0) {
    return null;
  }
  const cursorHit = hits.find((hit) => hit.record.key === cursorKey);
  return (
    <ListGridGroup
      label="Not in Tasks"
      isListbox
      headingLevel={2}
      {...(cursorHit === undefined
        ? {}
        : { activeDescendant: inboxOptionId({ key: cursorHit.record.key }) })}
      lead={
        state.status === 'loading' ? (
          <ListGridLine>{lookingUpText({ code, providers: lookup.loadingProviders })}</ListGridLine>
        ) : null
      }
      foot={
        statuses.length === 0
          ? null
          : statuses.map((status) => (
              <LookupStatusRow
                key={status.key}
                status={status}
                retryAt={status.key.endsWith(':rate-limited') ? lookup.retryAt : null}
                onAction={(chosen) => {
                  if (chosen.action?.kind === 'retry') {
                    lookup.retry();
                    return;
                  }
                  if (chosen.action?.kind === 'open-integrations') {
                    openToolSettings({ tool: chosen.action.provider });
                  }
                }}
              />
            ))
      }
    >
      {hits.map((hit) => (
        <InboxRow
          key={hit.record.key}
          record={hit.record}
          selected={selectedKey === hit.record.key}
          isCursor={cursorKey === hit.record.key}
          onSelect={() => onSelect(hit)}
          onActivate={onActivate}
          isStarred={starOf?.(hit.record)}
          onToggleStar={onToggleStar}
        />
      ))}
    </ListGridGroup>
  );
};
