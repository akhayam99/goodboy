import { Eyebrow, WorkNode } from '@goodboy/ui';
import type { WorkspaceIssueLookup } from '../../../integrations/hooks/useWorkspaceIssueLookup';
import type { LookupHit } from '../../../integrations/issueCode/lookupIssueByCode';
import {
  lookingUpText,
  lookupHitSecondLine,
  lookupStatuses,
} from '../../../integrations/issueCode/lookupCopy';
import { openToolSettings } from '../../../integrations/openToolSettings';
import { InboxRow } from './InboxRow';
import type { InboxRecord } from '../../types';
import { LookupStatusRow } from './LookupStatusRow';

type Props = {
  readonly lookup: WorkspaceIssueLookup;
  readonly workspaceName: string;
  readonly selectedKey: string | null;
  readonly onSelect: (hit: LookupHit) => void;
  readonly onActivate?: (record: InboxRecord) => void;
  readonly starOf?: (record: InboxRecord) => boolean | undefined;
  readonly onToggleStar?: (record: InboxRecord) => void;
};

export const InboxLookupGroup = ({
  lookup,
  workspaceName,
  selectedKey,
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
  return (
    <section aria-label="Not in Tasks" className="flex flex-col gap-0.5 pb-2">
      <div className="px-3 py-1">
        <Eyebrow label="Not in Tasks" />
      </div>
      {state.status === 'loading' ? (
        <div className="flex h-8 items-center gap-3 px-3 text-label text-muted-foreground">
          <WorkNode size="sm" state="running" mark={{ kind: 'dot' }} label="Looking up" />
          {lookingUpText({ code, providers: lookup.loadingProviders })}
        </div>
      ) : null}
      {hits.map((hit) => {
        const secondLine = lookupHitSecondLine(hit.record);
        return (
          <div key={hit.record.key} className="flex flex-col">
            <InboxRow
              record={hit.record}
              selected={selectedKey === hit.record.key}
              onSelect={() => onSelect(hit)}
              onActivate={onActivate}
              isStarred={starOf?.(hit.record)}
              onToggleStar={onToggleStar}
            />
            {secondLine === '' ? null : (
              <span className="h-4 truncate pl-[122px] text-meta text-faint-foreground">
                {secondLine}
              </span>
            )}
          </div>
        );
      })}
      {statuses.map((status) => (
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
      ))}
    </section>
  );
};
