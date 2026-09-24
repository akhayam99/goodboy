import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { cn, Skeleton, Eyebrow } from '@goodboy/ui';
import type { IsoDateTime, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import {
  TRACKER_STUDIO_LINKS,
  TrackerStudioLinks,
} from '../../../integrations/components/TrackerStudioLinks';
import { OverviewActions } from '../SessionOverviewPane/OverviewActions';
import { MountProjectAction } from '../SessionOverviewPane/ProjectMountRows/MountProjectAction';
import { useKickoffIssues } from './useKickoffIssues';

type Props = {
  readonly session: Session;
  readonly onOpenWorkflowBuilder: () => void;
  readonly onPickIssue?: (params: PickIssueParams) => void;
};

type PickIssueParams = {
  readonly candidate: IssueCandidate;
};

export const SessionKickoff = ({ session, onOpenWorkflowBuilder, onPickIssue }: Props) => {
  const issues = useKickoffIssues({ workspaceId: session.workspaceId });
  const linkSessionExternalTask = useAppStore((state) => state.linkSessionExternalTask);
  const reportError = useAppStore((state) => state.reportError);
  const { showToast } = useToast();
  const [linkingKey, setLinkingKey] = useState<string | null>(null);
  const hasMounts = useAppStore(
    (state) => (state.sessionProjectMounts[session.id] ?? EMPTY_ARRAY).length > 0,
  );

  const pickIssue = async ({ candidate }: PickIssueParams) => {
    const key = `${candidate.provider}:${candidate.externalId}`;
    setLinkingKey(key);
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
      setLinkingKey(null);
    }
  };

  const emptyStateLinks = issues.hasSources
    ? TRACKER_STUDIO_LINKS.filter((link) =>
        issues.sources.some((source) => source.provider === link.provider),
      )
    : TRACKER_STUDIO_LINKS;

  return (
    <section aria-label="Kickoff" className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5 px-0.5">
        <h3 className="text-sm font-medium text-foreground">How do you want to start?</h3>
        <p className="text-xs text-muted-foreground">
          Pick a starting point. These suggestions step aside once the first activity lands.
        </p>
      </header>
      {hasMounts ? null : (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2">
          <p className="min-w-0 text-xs text-muted-foreground">
            Mount a project first so agents have code to work in.
          </p>
          <MountProjectAction
            sessionId={session.id}
            workspaceId={session.workspaceId}
            presentation="button"
          />
        </div>
      )}
      <OverviewActions
        sessionId={session.id}
        variant="tile"
        onOpenWorkflowBuilder={onOpenWorkflowBuilder}
      />
      <div className="flex flex-col gap-1">
        <Eyebrow label="Or pick up an issue" className="px-0.5" />
        {issues.hasSources && issues.isLoaded && issues.rows.length > 0
          ? issues.rows.map((row) => {
              const key = `${row.provider}:${row.externalId}`;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={linkingKey != null}
                  onClick={() => void pickIssue({ candidate: row })}
                  className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left motion-safe:transition-colors hover:bg-hover disabled:opacity-60"
                >
                  <IntegrationGlyph provider={row.provider} size="xs" />
                  <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                    {row.identifier}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {row.title}
                  </span>
                  <span
                    className={cn(
                      'flex shrink-0 items-center gap-1 text-2xs text-muted-foreground opacity-0 motion-safe:transition-opacity group-hover:opacity-100',
                      linkingKey === key && 'opacity-100',
                    )}
                  >
                    <Link2 size={11} aria-hidden />
                    {linkingKey === key ? 'Linking…' : 'Link to this session'}
                  </span>
                </button>
              );
            })
          : null}
        {issues.hasSources && !issues.isLoaded ? (
          <div role="status" aria-label="Loading issues" className="flex flex-col gap-1 py-0.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="size-4 shrink-0 rounded-sm" />
                <Skeleton className="h-3 w-14 shrink-0 rounded-sm" />
                <Skeleton className="h-3 min-w-0 flex-1 rounded-sm" />
              </div>
            ))}
          </div>
        ) : null}
        {!issues.hasSources || (issues.isLoaded && issues.rows.length === 0) ? (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              {issues.hasSources ? 'No open issues detected' : 'No tracker connected yet'}
            </p>
            <div className="shrink-0">
              <TrackerStudioLinks links={emptyStateLinks} connected={issues.connected} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
