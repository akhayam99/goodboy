import type { ReactNode } from 'react';
import { DollarSign, Layers, Plug } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { IntegrationGlyph } from '../../../features/integrations/components/IntegrationGlyph';

type FooterButtonProps = {
  icon: ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  pulse?: boolean;
  active?: boolean;
};

const FooterButton = ({ icon, label, title, onClick, pulse, active }: FooterButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    title={title ?? label}
    aria-label={title ?? label}
    className={cn(
      'flex items-center gap-1.5 rounded px-2 py-1 text-2xs font-medium transition-colors',
      active
        ? 'bg-foreground text-background'
        : pulse
          ? 'animate-soft-pulse text-info hover:bg-info/10'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    )}
  >
    {icon}
    <span>{label}</span>
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
  linearEnabled,
  sentryEnabled,
  gitlabEnabled,
}: Props) => {
  const noProviderConnected = useAppStore(
    (s) => !s.providers.some((p) => p.connection === 'connected'),
  );

  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-t border-border-soft bg-background px-2">
      <div className="flex items-center gap-0.5">
        {!gitlabEnabled ? (
          <FooterButton
            icon={<IntegrationGlyph provider="github" size="xs" />}
            label="GitHub"
            title="review and act on pull requests across this workspace"
            onClick={onOpenGithub}
            active={activeStudio === 'github'}
          />
        ) : null}
        {gitlabEnabled ? (
          <FooterButton
            icon={<IntegrationGlyph provider="gitlab" size="xs" />}
            label="GitLab"
            title="launch a session from a GitLab issue"
            onClick={onOpenGitlab}
            active={activeStudio === 'gitlab'}
          />
        ) : null}
        {linearEnabled ? (
          <FooterButton
            icon={<IntegrationGlyph provider="linear" size="xs" />}
            label="Linear"
            title="launch a session from a Linear issue"
            onClick={onOpenLinear}
            active={activeStudio === 'linear'}
          />
        ) : null}
        {sentryEnabled ? (
          <FooterButton
            icon={<IntegrationGlyph provider="sentry" size="xs" />}
            label="Sentry"
            title="launch a session from a Sentry issue"
            onClick={onOpenSentry}
            active={activeStudio === 'sentry'}
          />
        ) : null}
      </div>

      <div className="flex items-center gap-0.5">
        <FooterButton
          icon={<Layers size={12} aria-hidden />}
          label="Workflows"
          title="open the workflow library for this workspace"
          onClick={onOpenWorkflows}
          active={activeStudio === 'workflow'}
        />
        <FooterButton
          icon={<Plug size={12} aria-hidden />}
          label="Providers"
          title="connect and manage your provider accounts"
          onClick={onOpenProviders}
          pulse={noProviderConnected && activeStudio !== 'provider'}
          active={activeStudio === 'provider'}
        />
        <FooterButton
          icon={<DollarSign size={12} aria-hidden />}
          label="Budget"
          title="open budget studio"
          onClick={onOpenBudget}
          active={activeStudio === 'budget'}
        />
      </div>
    </div>
  );
};
