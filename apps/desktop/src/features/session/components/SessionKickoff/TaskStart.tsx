import { useState } from 'react';
import { Button, Input, Skeleton, cn } from '@goodboy/ui';
import type { IsoDateTime, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import {
  TRACKER_STUDIO_LINKS,
  TrackerStudioLinks,
} from '../../../integrations/components/TrackerStudioLinks';
import type { KickoffIssues } from './useKickoffIssues';
import { StartFooter } from './StartFooter';

type PickIssueParams = {
  readonly candidate: IssueCandidate;
};

type Props = {
  readonly session: Session;
  readonly issues: KickoffIssues;
  readonly onPickIssue?: (params: PickIssueParams) => void;
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

export const TaskStart = ({ session, issues, onPickIssue }: Props) => {
  const linkSessionExternalTask = useAppStore((state) => state.linkSessionExternalTask);
  const reportError = useAppStore((state) => state.reportError);
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const visibleRows = issues.rows.filter((candidate) => matchesQuery({ candidate, query }));
  const selected =
    visibleRows.find((candidate) => candidateKey({ candidate }) === selectedKey) ?? null;

  const pickUp = async ({ candidate }: PickIssueParams) => {
    setIsLinking(true);
    try {
      await linkSessionExternalTask(session.id, {
        provider: candidate.provider,
        externalId: candidate.externalId,
        identifier: candidate.identifier,
        title: candidate.title,
        url: candidate.url,
        createdAt: new Date().toISOString() as IsoDateTime,
      });
      onPickIssue?.({ candidate });
      showToast({ kind: 'success', message: `Linked ${candidate.identifier} to this session.` });
    } catch (cause) {
      void reportError({
        title: `Couldn't link ${candidate.identifier}`,
        error: cause,
        sessionId: session.id,
      });
    } finally {
      setIsLinking(false);
    }
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
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || selected == null) {
            return;
          }
          event.preventDefault();
          void pickUp({ candidate: selected });
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
                disabled={isLinking}
                onClick={() => setSelectedKey(key)}
                onDoubleClick={() => void pickUp({ candidate })}
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
      <StartFooter note={selected == null ? 'Pick an issue to link it to this session.' : null}>
        <Button
          size="sm"
          disabled={selected == null || isLinking}
          isBusy={isLinking}
          busyLabel="Linking"
          onClick={() => {
            if (selected == null) {
              return;
            }
            void pickUp({ candidate: selected });
          }}
        >
          {selected == null ? 'Pick up issue' : `Pick up ${selected.identifier}`}
        </Button>
      </StartFooter>
    </div>
  );
};
