import { Button, EmptyLine, Eyebrow, Input, Skeleton } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useState } from 'react';
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
import { pickIssue } from '../../pickIssue';
import { draftIssueKey } from '../../../../store/slices/sessionDraft/draftIssueKey';
import { removeDraftIssue } from '../../../../store/slices/sessionDraft/removeDraftIssue';
import { toggleDraftIssue } from '../../../../store/slices/sessionDraft/toggleDraftIssue';
import { issueBriefSources } from './issueBriefSources';
import { useWorkspaceIssueLookup } from '../../../integrations/hooks/useWorkspaceIssueLookup';
import { InboxLookupGroup } from '../../../inbox/components/InboxStudio/InboxLookupGroup';
import { parsePullRequestUrl } from '../../../integrations/issueCode/parsePullRequestUrl';
import { ISSUE_SEARCH_PLACEHOLDER } from '../../../integrations/issueCode/lookupCopy';
import { candidateOfRecord } from '../../../integrations/starred/candidateOfRecord';
import { useInboxStars } from '../../../inbox/useInboxStars';
import type { InboxRecord } from '../../../inbox/types';
import { NAMES } from '../../../../shared/names';
import { ISSUE_CAP_LINE, pickIssuesLabel } from '../../../../shared/lib/startCopy';
import { IssueCandidateRow } from './IssueCandidateRow';

const EMPTY_RECORDS: ReadonlyArray<InboxRecord> = [];

type PickIssueParams = {
  readonly candidate: IssueCandidate;
};

type RemoveParams = {
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
  const pickedIssues = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).pickedIssues,
  );
  const hasPickedStep = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).hasPickedStep,
  );
  const requestIssueBrief = useAppStore((state) => state.requestIssueBrief);
  const [isCapShown, setIsCapShown] = useState(false);

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
  const starredKeys = new Set(starredRows.map((candidate) => draftIssueKey({ candidate })));
  const visibleRows = issues.rows.filter(
    (candidate) =>
      matchesQuery({ candidate, query }) && !starredKeys.has(draftIssueKey({ candidate })),
  );
  const selectedKeys = new Set(pickedIssues.map((candidate) => draftIssueKey({ candidate })));
  const isSelecting = pickedIssues.length > 0;
  const selectedLookupKey =
    lookupHits.find((hit) => selectedKeys.has(draftIssueKey({ candidate: hit.candidate })))?.record
      .key ?? null;
  const pastedPullRequest = parsePullRequestUrl(query);
  const workspaceName = useAppStore(
    (state) => state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? '',
  );

  const toggle = ({ candidate }: PickIssueParams) => {
    const result = toggleDraftIssue({ picked: pickedIssues, candidate });
    setIsCapShown(result.isRefused);
    if (result.isRefused) {
      return;
    }
    patchSessionDraft({ workspaceId, patch: { pickedIssues: result.picked, choice: 'task' } });
  };

  const focusRow = ({ candidate }: PickIssueParams) =>
    patchSessionDraft({
      workspaceId,
      patch: { focusedIssueKey: draftIssueKey({ candidate }) },
    });

  const confirm = () => {
    if (pickedIssues.length === 0) {
      return;
    }
    patchSessionDraft({ workspaceId, patch: { hasPickedStep: true } });
    void requestIssueBrief({
      sources: issueBriefSources({ candidates: pickedIssues }),
      workspaceId,
      sessionId: null,
    });
  };

  const pickAlone = ({ candidate }: PickIssueParams) => {
    setIsCapShown(false);
    pickIssue({ workspaceId, candidate });
  };

  const remove = ({ key }: RemoveParams) => {
    const rest = removeDraftIssue({ picked: pickedIssues, key });
    patchSessionDraft({
      workspaceId,
      patch: { pickedIssues: rest, hasPickedStep: rest.length > 0 },
    });
  };

  if (hasPickedStep && pickedIssues.length > 0) {
    return (
      <PickedIssue
        key={pickedIssues.map((candidate) => draftIssueKey({ candidate })).join('|')}
        workspaceId={workspaceId}
        candidates={pickedIssues}
        onRemove={remove}
        onAddAnother={() => patchSessionDraft({ workspaceId, patch: { hasPickedStep: false } })}
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
          if (event.key !== 'Enter' || !isSelecting) {
            return;
          }
          event.preventDefault();
          confirm();
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
            onSelect={(hit) => toggle({ candidate: hit.candidate })}
          />
          {starredRows.length === 0 ? null : (
            <div className="flex flex-col gap-0.5">
              <div className="px-2 py-1">
                <Eyebrow label="Starred" />
              </div>
              <ul aria-label="Starred issues" className="flex flex-col gap-0.5">
                {starredRows.map((candidate) => {
                  const key = draftIssueKey({ candidate });
                  return (
                    <li key={key}>
                      <IssueCandidateRow
                        candidate={candidate}
                        isSelected={selectedKeys.has(key)}
                        isSelecting={isSelecting}
                        onToggle={() => toggle({ candidate })}
                        onFocusRow={() => focusRow({ candidate })}
                        onPickAlone={() => pickAlone({ candidate })}
                        onConfirm={confirm}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <ul aria-label="Issues" className="flex flex-col gap-0.5">
            {visibleRows.map((candidate) => {
              const key = draftIssueKey({ candidate });
              return (
                <li key={key}>
                  <IssueCandidateRow
                    candidate={candidate}
                    isSelected={selectedKeys.has(key)}
                    isSelecting={isSelecting}
                    onToggle={() => toggle({ candidate })}
                    onFocusRow={() => focusRow({ candidate })}
                    onPickAlone={() => pickAlone({ candidate })}
                    onConfirm={confirm}
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
          {isCapShown ? (
            <p role="status" className="px-2 text-meta text-faint-foreground">
              {ISSUE_CAP_LINE}
            </p>
          ) : null}
          <StartFooter note={isSelecting ? null : 'Pick an issue to start from it.'}>
            <Button size="sm" disabled={!isSelecting} onClick={confirm}>
              {isSelecting
                ? pickIssuesLabel({
                    identifiers: pickedIssues.map((candidate) => candidate.identifier),
                  })
                : NAMES.pickAnIssue}
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
