import { useState } from 'react';
import { Button, Input, Skeleton, cn } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import {
  TRACKER_STUDIO_LINKS,
  TrackerStudioLinks,
} from '../../../integrations/components/TrackerStudioLinks';
import type { KickoffIssues } from './useKickoffIssues';
import { StartFooter } from './StartFooter';
import { DraftIssueBrief } from './DraftIssueBrief';
import { HowToWorkOnIt } from './HowToWorkOnIt';
import { issueBriefSource } from './issueBriefSource';
import { useDraftStart } from './useDraftStart';

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

const candidateKey = ({ candidate }: PickIssueParams): string =>
  `${candidate.provider}:${candidate.externalId}`;

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
  const requestIssueBrief = useAppStore((state) => state.requestIssueBrief);
  const query = useAppStore((state) => selectSessionDraft({ state, workspaceId }).issueQuery);
  const selectedKey = useAppStore((state) => selectSessionDraft({ state, workspaceId }).issueKey);
  const pickedIssue = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).pickedIssue,
  );
  const { start, isStarting, error } = useDraftStart({ workspaceId });
  const [acceptedBrief, setAcceptedBrief] = useState<{
    readonly title: string;
    readonly goal: string;
  } | null>(null);

  const visibleRows = issues.rows.filter((candidate) => matchesQuery({ candidate, query }));
  const selected =
    visibleRows.find((candidate) => candidateKey({ candidate }) === selectedKey) ?? null;

  const select = ({ key }: SelectParams) => {
    const isPickedRow = pickedIssue !== null && candidateKey({ candidate: pickedIssue }) === key;
    patchSessionDraft({
      workspaceId,
      patch: { issueKey: key, pickedIssue: isPickedRow ? pickedIssue : null },
    });
  };

  const pickUp = ({ candidate }: PickIssueParams) => {
    patchSessionDraft({
      workspaceId,
      patch: { issueKey: candidateKey({ candidate }), pickedIssue: candidate },
    });
    void requestIssueBrief({
      source: issueBriefSource({ candidate }),
      workspaceId,
      sessionId: null,
    });
  };

  if (!issues.hasSources || (issues.isLoaded && issues.rows.length === 0)) {
    const links = issues.hasSources
      ? TRACKER_STUDIO_LINKS.filter((link) =>
          issues.sources.some((source) => source.provider === link.provider),
        )
      : TRACKER_STUDIO_LINKS;
    return (
      <div className="flex flex-wrap items-center gap-2 px-2.5 py-1.5">
        <p className="min-w-0 flex-1 text-label text-muted-foreground">
          {issues.hasSources ? 'No open issues detected' : 'No tracker connected yet'}
        </p>
        <div className="shrink-0">
          <TrackerStudioLinks links={links} connected={issues.connected} />
        </div>
      </div>
    );
  }

  if (!issues.isLoaded) {
    return (
      <div role="status" aria-label="Loading issues" className="flex flex-col gap-1 py-0.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-2 px-2.5 py-1.5">
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
        placeholder="Search issues"
        data-kickoff-field
        className="h-8 text-body"
      />
      <ul aria-label="Issues" className="flex flex-col gap-0.5">
        {visibleRows.map((candidate) => {
          const key = candidateKey({ candidate });
          const isSelected = key === selectedKey;
          return (
            <li key={key}>
              <button
                type="button"
                aria-pressed={isSelected}
                disabled={isStarting}
                onClick={() => select({ key })}
                onDoubleClick={() => pickUp({ candidate })}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left motion-safe:transition-colors disabled:opacity-60',
                  isSelected ? 'bg-selected' : 'hover:bg-hover',
                )}
              >
                <IntegrationGlyph provider={candidate.provider} size="xs" />
                <span className="shrink-0 font-mono text-secondary text-muted-foreground">
                  {candidate.identifier}
                </span>
                <span className="min-w-0 flex-1 truncate text-body text-foreground">
                  {candidate.title}
                </span>
              </button>
            </li>
          );
        })}
        {visibleRows.length === 0 ? (
          <li className="px-2 py-1.5 text-label text-muted-foreground">No issue matches</li>
        ) : null}
      </ul>
      {pickedIssue === null ? (
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
            {selected == null ? 'Pick up issue' : `Pick up ${selected.identifier}`}
          </Button>
        </StartFooter>
      ) : (
        <div className="flex flex-col gap-2">
          <DraftIssueBrief
            workspaceId={workspaceId}
            candidate={pickedIssue}
            onStart={({ title, goal }) => setAcceptedBrief({ title, goal })}
            onDismiss={() => {
              setAcceptedBrief(null);
              patchSessionDraft({ workspaceId, patch: { pickedIssue: null } });
            }}
          />
          {acceptedBrief == null ? null : (
            <HowToWorkOnIt
              workspaceId={workspaceId}
              goal={acceptedBrief.goal}
              isStarting={isStarting}
              error={error}
              onStart={(then) =>
                void start({
                  kind: 'task',
                  candidate: pickedIssue,
                  title: acceptedBrief.title,
                  goal: acceptedBrief.goal,
                  then,
                })
              }
            />
          )}
        </div>
      )}
    </div>
  );
};
