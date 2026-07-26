import type { ReactNode } from 'react';
import { cn, Divider } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { IntegrationGlyph } from '../../../features/integrations/components/IntegrationGlyph';
import { SECTION_ICONS } from '../../../shared/components/section-icons';

type FooterButtonProps = {
  icon: ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  pulse?: boolean;
  active?: boolean;
  connected?: boolean;
};

const FooterButton = ({
  icon,
  label,
  title,
  onClick,
  pulse,
  active,
  connected,
}: FooterButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    title={title ?? label}
    aria-label={title ?? label}
    className={cn(
      'relative flex items-center gap-1.5 rounded px-2 py-1 text-2xs font-medium transition-colors',
      active
        ? 'bg-foreground text-background'
        : pulse
          ? 'animate-soft-pulse text-info hover:bg-info/10'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      connected === false && 'opacity-40',
    )}
  >
    {icon}
    <span>{label}</span>
    {connected === false ? (
      <span
        aria-hidden
        className="absolute right-0 top-0 size-1.5 rounded-full bg-warning ring-1 ring-subtle"
      />
    ) : null}
  </button>
);

type Props = {
  activeStudio: string | null;
  onOpenWorkflows: () => void;
  onOpenProviders: () => void;
  onOpenBudget: () => void;
  onOpenGithub: () => void;
  onOpenLinear: () => void;
  onOpenSentry: () => void;
  onOpenGitlab: () => void;
  githubEnabled: boolean;
  linearEnabled: boolean;
  sentryEnabled: boolean;
  gitlabEnabled: boolean;
};

export const AppFooter = ({
  activeStudio,
  onOpenWorkflows,
  onOpenProviders,
  onOpenBudget,
  onOpenGithub,
  onOpenLinear,
  onOpenSentry,
  onOpenGitlab,
  githubEnabled,
  linearEnabled,
  sentryEnabled,
  gitlabEnabled,
}: Props) => {
  const noProviderConnected = useAppStore(
    (s) => !s.providers.some((p) => p.connection === 'connected'),
  );

  return (
    <div className="flex shrink-0 flex-col">
      <Divider />
      <div className="relative flex h-9 items-center justify-between bg-background px-2">
        <div className="flex items-center gap-0.5">
          <FooterButton
            icon={<IntegrationGlyph provider="github" size="xs" />}
            label="GitHub"
            title={
              githubEnabled
                ? 'review and act on pull requests across this workspace'
                : 'Connect GitHub'
            }
            onClick={
              githubEnabled
                ? onOpenGithub
                : () =>
                    window.dispatchEvent(
                      new CustomEvent('goodboy:open-workspace-settings', {
                        detail: { section: 'integrations' },
                      }),
                    )
            }
            active={activeStudio === 'github'}
            connected={githubEnabled}
          />
          <FooterButton
            icon={<IntegrationGlyph provider="gitlab" size="xs" />}
            label="GitLab"
            title={gitlabEnabled ? 'launch a session from a GitLab issue' : 'Connect GitLab'}
            onClick={
              gitlabEnabled
                ? onOpenGitlab
                : () =>
                    window.dispatchEvent(
                      new CustomEvent('goodboy:open-workspace-settings', {
                        detail: { section: 'integrations' },
                      }),
                    )
            }
            active={activeStudio === 'gitlab'}
            connected={gitlabEnabled}
          />
          <FooterButton
            icon={<IntegrationGlyph provider="linear" size="xs" />}
            label="Linear"
            title={linearEnabled ? 'launch a session from a Linear issue' : 'Connect Linear'}
            onClick={
              linearEnabled
                ? onOpenLinear
                : () =>
                    window.dispatchEvent(
                      new CustomEvent('goodboy:open-workspace-settings', {
                        detail: { section: 'integrations' },
                      }),
                    )
            }
            active={activeStudio === 'linear'}
            connected={linearEnabled}
          />
          <FooterButton
            icon={<IntegrationGlyph provider="sentry" size="xs" />}
            label="Sentry"
            title={sentryEnabled ? 'launch a session from a Sentry issue' : 'Connect Sentry'}
            onClick={
              sentryEnabled
                ? onOpenSentry
                : () =>
                    window.dispatchEvent(
                      new CustomEvent('goodboy:open-workspace-settings', {
                        detail: { section: 'integrations' },
                      }),
                    )
            }
            active={activeStudio === 'sentry'}
            connected={sentryEnabled}
          />
        </div>

        <span className="pointer-events-none absolute inset-x-0 mx-auto w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/15">
          Beta
        </span>

        <div className="flex items-center gap-0.5">
          <FooterButton
            icon={<SECTION_ICONS.workflows size={12} aria-hidden />}
            label="Workflows"
            title="open the workflow library for this workspace"
            onClick={onOpenWorkflows}
            active={activeStudio === 'workflow'}
          />
          <FooterButton
            icon={<SECTION_ICONS.providers size={12} aria-hidden />}
            label="Providers"
            title="connect and manage your provider accounts"
            onClick={onOpenProviders}
            pulse={noProviderConnected && activeStudio !== 'provider'}
            active={activeStudio === 'provider'}
          />
          <FooterButton
            icon={<SECTION_ICONS.budget size={12} aria-hidden />}
            label="Budget"
            title="open budget studio"
            onClick={onOpenBudget}
            active={activeStudio === 'budget'}
          />
        </div>
      </div>
    </div>
  );
};
