import { useState } from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { cn, formatError, Skeleton } from '@goodboy/ui';
import type { IsoDateTime, Session } from '@goodboy/types';
import type { LucideIcon } from 'lucide-react';
import { useAppStore, useSessionSlots } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import type { IssueSource } from '../../../integrations/issueSources';
import { CreateAgentPopover } from '../CreateAgentPopover';
import { useKickoffIssues } from './useKickoffIssues';

const TILE_CLASS =
  'group flex w-full items-center gap-2.5 rounded-lg border border-border-soft bg-elevated px-3 py-2.5 text-left shadow-sm transition-colors hover:border-border';

type ConnectableProvider = 'linear' | 'github' | 'gitlab' | 'jira' | 'sentry';

const STUDIO_OPEN_EVENT: Record<ConnectableProvider, string> = {
  linear: 'goodboy:open-linear-studio',
  github: 'goodboy:open-github-studio',
  gitlab: 'goodboy:open-gitlab-studio',
  jira: 'goodboy:open-jira-studio',
  sentry: 'goodboy:open-sentry-studio',
};

const CONNECTABLE_SOURCES: ReadonlyArray<IssueSource & { readonly provider: ConnectableProvider }> =
  [
    { provider: 'linear', label: 'Linear' },
    { provider: 'github', label: 'GitHub' },
    { provider: 'gitlab', label: 'GitLab' },
    { provider: 'jira', label: 'Jira' },
    { provider: 'sentry', label: 'Sentry' },
  ];

type TileProps = {
  readonly icon: LucideIcon;
  readonly iconClassName: string;
  readonly title: string;
  readonly description: string;
  readonly onClick: () => void;
};

const KickoffTile = ({ icon: Icon, iconClassName, title, description, onClick }: TileProps) => (
  <button type="button" onClick={onClick} className={TILE_CLASS}>
    <Icon size={16} aria-hidden className={cn('shrink-0', iconClassName)} />
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
      <span className="text-sm font-medium text-foreground">{title}</span>
      <span className="truncate text-2xs text-muted-foreground">{description}</span>
    </span>
    <ArrowRight
      size={15}
      aria-hidden
      className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
    />
  </button>
);

type Props = {
  readonly session: Session;
  readonly onOpenWorkflowBuilder: () => void;
};

export const SessionKickoff = ({ session, onOpenWorkflowBuilder }: Props) => {
  const issues = useKickoffIssues({ workspaceId: session.workspaceId });
  const linkSessionExternalTask = useAppStore((state) => state.linkSessionExternalTask);
  const autoTitleSession = useAppStore((state) => state.autoTitleSession);
  const upsertSessionSlot = useAppStore((state) => state.upsertSessionSlot);
  const slots = useSessionSlots(session.id);
  const { showToast } = useToast();
  const [linkingKey, setLinkingKey] = useState<string | null>(null);

  const pickIssue = async (candidate: IssueCandidate) => {
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
      const goalSlot = slots.find((slot) => slot.key === 'goal');
      if (goalSlot == null || goalSlot.value.trim() === '') {
        await upsertSessionSlot(session.id, 'goal', candidate.goal);
      }
      await autoTitleSession(session.id, `[${candidate.identifier}] ${candidate.title}`);
      showToast('success', `${candidate.identifier} linked to this session`);
    } catch (cause) {
      showToast('error', formatError(cause));
    } finally {
      setLinkingKey(null);
    }
  };

  const revealChat = () => {
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  const emptyStateSources = issues.hasSources
    ? issues.sources.filter(
        (source): source is IssueSource & { readonly provider: ConnectableProvider } =>
          source.provider !== 'slack',
      )
    : CONNECTABLE_SOURCES;

  return (
    <section aria-label="Kickoff" className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5 px-0.5">
        <h3 className="text-sm font-medium text-foreground">How do you want to start?</h3>
        <p className="text-xs text-muted-foreground">
          Pick a starting point. These suggestions step aside once the first activity lands.
        </p>
      </header>
      <div className="grid gap-2 lg:grid-cols-3">
        <KickoffTile
          icon={CONCEPT_ICONS.comments}
          iconClassName="text-primary"
          title="Start in chat"
          description="Describe what you need and go from there."
          onClick={revealChat}
        />
        <CreateAgentPopover
          sessionId={session.id}
          variant="tile"
          description="Brief a specialist and let it run."
        />
        <KickoffTile
          icon={CONCEPT_ICONS.workflows}
          iconClassName="text-accent"
          title="Add a workflow"
          description="Run a multi-step plan with checkpoints."
          onClick={onOpenWorkflowBuilder}
        />
      </div>
      <div className="flex flex-col gap-1">
        <p className="px-0.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          Or pick up an issue
        </p>
        {issues.hasSources && issues.isLoaded && issues.rows.length > 0
          ? issues.rows.map((row) => {
              const key = `${row.provider}:${row.externalId}`;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={linkingKey != null}
                  onClick={() => void pickIssue(row)}
                  className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left motion-safe:transition-colors hover:bg-muted/60 disabled:opacity-60"
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
                <Skeleton className="size-4 shrink-0 rounded" />
                <Skeleton className="h-3 w-14 shrink-0 rounded" />
                <Skeleton className="h-3 min-w-0 flex-1 rounded" />
              </div>
            ))}
          </div>
        ) : null}
        {!issues.hasSources || (issues.isLoaded && issues.rows.length === 0) ? (
          <div className="flex flex-col gap-1.5 rounded-md border border-dashed border-border px-3 py-2.5">
            <p className="text-sm text-foreground">
              {issues.hasSources
                ? 'No open issues waiting for a session'
                : 'No tracker connected yet'}
            </p>
            <p className="text-xs text-muted-foreground">
              {issues.hasSources
                ? 'New issues land here as they arrive. Browse the studios for everything else.'
                : 'Connect one to pick up issues right from here.'}
            </p>
            <div className="flex items-center gap-1.5">
              {emptyStateSources.map((source) => (
                <button
                  key={source.provider}
                  type="button"
                  aria-label={`Open the ${source.label} studio`}
                  className="inline-flex size-7 items-center justify-center rounded-md border border-border-soft bg-elevated motion-safe:transition-colors hover:border-border"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent(STUDIO_OPEN_EVENT[source.provider]))
                  }
                >
                  <IntegrationGlyph provider={source.provider} size="xs" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
