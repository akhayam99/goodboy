import { Button, EmptyLine, Eyebrow, Input, Skeleton } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import {
  TRACKER_STUDIO_LINKS,
  TrackerStudioLinks,
} from '../../../integrations/components/TrackerStudioLinks';
import type { KickoffIssues } from './useKickoffIssues';
import { StartFooter } from './StartFooter';
import { PastedPullRequest } from './PastedPullRequest';
import { PickedIssue } from './PickedIssue';
import { candidateKey, pickIssue } from '../../pickIssue';
import { useWorkspaceIssueLookup } from '../../../integrations/hooks/useWorkspaceIssueLookup';
import { InboxLookupGroup } from '../../../inbox/components/InboxStudio/InboxLookupGroup';
import { parsePullRequestUrl } from '../../../integrations/issueCode/parsePullRequestUrl';
import { ISSUE_SEARCH_PLACEHOLDER } from '../../../integrations/issueCode/lookupCopy';
import { candidateOfRecord } from '../../../integrations/starred/candidateOfRecord';
import { useInboxStars } from '../../../inbox/useInboxStars';
import type { InboxRecord } from '../../../inbox/types';
import { NAMES } from '../../../../shared/names';
import { pickLabel } from '../../../../shared/lib/startCopy';
import { IssueCandidateRow } from './IssueCandidateRow';

const EMPTY_RECORDS: ReadonlyArray<InboxRecord> = [];

type PickIssueParams = {
  readonly candidate: IssueCandidate;
};

type SelectParams = {
  readonly key: string;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly issues: KickoffIssues;
};

const matchesQuery = ({ candidate, query }: PickIssueParams & { readonly query: string }) => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return (
    candidate.identifier.toLowerCase().includes(needle) ||
    candidate.title.toLowerCase().includes(needle)
  );
};

export const TaskStart = ({ workspaceId, issues }: Props) => {
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const query = useAppStore((state) => selectSessionDraft({ state, workspaceId }).issueQuery);
  const selectedKey = useAppStore((state) => selectSessionDraft({ state, workspaceId }).issueKey);
  const pickedIssue = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).pickedIssue,
  );

  const lookup = useWorkspaceIssueLookup({
    workspaceId,
    query,
    isKnown: (code) => issues.rows.some((row) => row.identifier.toUpperCase() === code),
  });
  const lookupHits = lookup.state.status === 'done' ? lookup.state.value.result.hits : [];
  const stars = useInboxStars({ workspaceId, records: EMPTY_RECORDS });
  const starredRows = stars.rows.flatMap((row) => {
    if (row.record === null || row.issue.state === 'done' || row.issue.state === 'missing') {
      return [];
    }
    const candidate = candidateOfRecord(row.record);
    return candidate === null || !matchesQuery({ candidate, query }) ? [] : [candidate];
  });
  const starredKeys = new Set(starredRows.map((candidate) => candidateKey({ candidate })));
  const visibleRows = issues.rows.filter(
    (candidate) =>
      matchesQuery({ candidate, query }) && !starredKeys.has(candidateKey({ candidate })),
  );
  const selected =
    [...starredRows, ...visibleRows, ...lookupHits.map((hit) => hit.candidate)].find(
      (candidate) => candidateKey({ candidate }) === selectedKey,
    ) ?? null;
  const selectedLookupKey =
    lookupHits.find((hit) => candidateKey({ candidate: hit.candidate }) === selectedKey)?.record
      .key ?? null;
  const pastedPullRequest = parsePullRequestUrl(query);
  const workspaceName = useAppStore(
    (state) => state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? '',
  );

  const select = ({ key }: SelectParams) => {
    const isPickedRow = pickedIssue !== null && candidateKey({ candidate: pickedIssue }) === key;
    patchSessionDraft({
      workspaceId,
      patch: { issueKey: key, pickedIssue: isPickedRow ? pickedIssue : null },
    });
  };

  const pickUp = ({ candidate }: PickIssueParams) => pickIssue({ workspaceId, candidate });

  if (pickedIssue !== null) {
    return (
      <PickedIssue
        key={candidateKey({ candidate: pickedIssue })}
        workspaceId={workspaceId}
        candidate={pickedIssue}
        onDismiss={() => patchSessionDraft({ workspaceId, patch: { pickedIssue: null } })}
      />
    );
  }

  if (!issues.hasSources) {
    return (
      <EmptyLine
        className="flex-wrap px-3 py-2"
        action={
          <div className="shrink-0">
            <TrackerStudioLinks links={TRACKER_STUDIO_LINKS} connected={issues.connected} />
          </div>
        }
      >
        No tracker connected yet
      </EmptyLine>
    );
  }

  if (!issues.isLoaded) {
    return (
      <div role="status" aria-label="Loading issues" className="flex flex-col gap-1 py-0.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-2 px-3 py-2">
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className="h-3 w-14 shrink-0 rounded-sm" />
            <Skeleton className="h-3 min-w-0 flex-1 rounded-sm" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={query}
        onChange={(event) =>
          patchSessionDraft({ workspaceId, patch: { issueQuery: event.target.value } })
        }
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || selected == null) {
            return;
          }
          event.preventDefault();
          pickUp({ candidate: selected });
        }}
        aria-label="Search issues"
        placeholder={ISSUE_SEARCH_PLACEHOLDER}
        data-kickoff-field
        className="h-8 text-body"
      />
      {pastedPullRequest === null ? (
        <>
          <InboxLookupGroup
            lookup={lookup}
            workspaceName={workspaceName}
            selectedKey={selectedLookupKey}
            onSelect={(hit) => select({ key: candidateKey({ candidate: hit.candidate }) })}
          />
          {starredRows.length === 0 ? null : (
            <div className="flex flex-col gap-0.5">
              <div className="px-2 py-1">
                <Eyebrow label="Starred" />
              </div>
              <ul aria-label="Starred issues" className="flex flex-col gap-0.5">
                {starredRows.map((candidate) => {
                  const key = candidateKey({ candidate });
                  return (
                    <li key={key}>
                      <IssueCandidateRow
                        candidate={candidate}
                        isSelected={key === selectedKey}
                        onSelect={() => select({ key })}
                        onPickUp={() => pickUp({ candidate })}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <ul aria-label="Issues" className="flex flex-col gap-0.5">
            {visibleRows.map((candidate) => {
              const key = candidateKey({ candidate });
              return (
                <li key={key}>
                  <IssueCandidateRow
                    candidate={candidate}
                    isSelected={key === selectedKey}
                    onSelect={() => select({ key })}
                    onPickUp={() => pickUp({ candidate })}
                  />
                </li>
              );
            })}
            {visibleRows.length === 0 ? (
              <li>
                <EmptyLine className="px-2">
                  {issues.rows.length === 0 ? 'No open issues detected' : 'No issue matches'}
                </EmptyLine>
              </li>
            ) : null}
          </ul>
          <StartFooter note={selected == null ? 'Pick an issue to start from it.' : null}>
            <Button
              size="sm"
              disabled={selected == null}
              onClick={() => {
                if (selected == null) {
                  return;
                }
                pickUp({ candidate: selected });
              }}
            >
              {selected == null
                ? NAMES.pickAnIssue
                : pickLabel({ identifier: selected.identifier })}
            </Button>
          </StartFooter>
        </>
      ) : (
        <PastedPullRequest
          key={pastedPullRequest.url}
          workspaceId={workspaceId}
          pasted={pastedPullRequest}
        />
      )}
    </div>
  );
};
