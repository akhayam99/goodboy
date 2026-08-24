import { Tooltip } from '@goodboy/ui';
import { IntegrationGlyph } from '../IntegrationGlyph';

export type TrackerProvider = 'linear' | 'github' | 'gitlab' | 'jira' | 'sentry';

export type TrackerStudioLink = {
  readonly provider: TrackerProvider;
  readonly label: string;
};

export const TRACKER_STUDIO_LINKS: ReadonlyArray<TrackerStudioLink> = [
  { provider: 'linear', label: 'Linear' },
  { provider: 'github', label: 'GitHub' },
  { provider: 'gitlab', label: 'GitLab' },
  { provider: 'jira', label: 'Jira' },
  { provider: 'sentry', label: 'Sentry' },
];

const STUDIO_OPEN_EVENT: Record<TrackerProvider, string> = {
  linear: 'goodboy:open-linear-studio',
  github: 'goodboy:open-github-studio',
  gitlab: 'goodboy:open-gitlab-studio',
  jira: 'goodboy:open-jira-studio',
  sentry: 'goodboy:open-sentry-studio',
};

const openTrackerStudio = ({ provider }: { readonly provider: TrackerProvider }): void => {
  window.dispatchEvent(
    new CustomEvent(
      STUDIO_OPEN_EVENT[provider],
      provider === 'github' ? { detail: { tab: 'issues' } } : undefined,
    ),
  );
};

type Props = {
  readonly links: ReadonlyArray<TrackerStudioLink>;
};

export const TrackerStudioLinks = ({ links }: Props) => (
  <div className="flex items-center gap-1">
    {links.map((link) => (
      <Tooltip key={link.provider} content={`Open the ${link.label} studio`}>
        <button
          type="button"
          aria-label={`Open the ${link.label} studio`}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60"
          onClick={() => openTrackerStudio({ provider: link.provider })}
        >
          <IntegrationGlyph provider={link.provider} size="xs" />
        </button>
      </Tooltip>
    ))}
  </div>
);
