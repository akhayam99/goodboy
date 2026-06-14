import { GitPullRequest, Layers, Plug, Sparkles } from 'lucide-react';
import { useAppStore } from '../../../../../store';
import { QuickAction } from './QuickAction';

type Props = {
  onOpenPalette: (initialQuery?: string) => void;
  onOpenWorkflows: () => void;
  onOpenLinear: () => void;
  onOpenSentry: () => void;
  onOpenGitlab: () => void;
  onOpenProviders: () => void;
  onOpenGithub: () => void;
  linearEnabled: boolean;
  sentryEnabled: boolean;
  gitlabEnabled: boolean;
  skillsEnabled: boolean;
};

export const QuickActionsRow = ({
  onOpenPalette,
  onOpenWorkflows,
  onOpenLinear,
  onOpenSentry,
  onOpenGitlab,
  onOpenProviders,
  onOpenGithub,
  linearEnabled,
  sentryEnabled,
  gitlabEnabled,
  skillsEnabled,
}: Props) => {
  const noProviderConnected = useAppStore(
    (s) => !s.providers.some((p) => p.connection === 'connected'),
  );
  return (
    <div className="flex shrink-0 items-center gap-1 px-2.5 py-2">
      {skillsEnabled ? (
        <QuickAction
          icon={<Sparkles size={12} className="text-warning" aria-hidden />}
          label="Skills"
          onClick={() => onOpenPalette('/')}
        />
      ) : null}

      <QuickAction
        icon={<Layers size={12} className="text-primary" aria-hidden />}
        label="Workflows"
        onClick={onOpenWorkflows}
      />
      <QuickAction
        icon={<Plug size={12} className="text-info" aria-hidden />}
        label="Providers"
        title="connect and manage your provider accounts"
        onClick={onOpenProviders}
        pulse={noProviderConnected}
      />
      {linearEnabled ? (
        <QuickAction
          icon={
            <span className="flex size-3 items-center justify-center rounded-[3px] bg-provider-linear text-[7px] font-bold text-white">
              L
            </span>
          }
          label="Linear"
          title="launch a session from a Linear issue"
          onClick={onOpenLinear}
        />
      ) : null}
      {sentryEnabled ? (
        <QuickAction
          icon={
            <span className="flex size-3 items-center justify-center rounded-[3px] bg-provider-sentry text-[7px] font-bold text-white">
              S
            </span>
          }
          label="Sentry"
          title="launch a session from a Sentry issue"
          onClick={onOpenSentry}
        />
      ) : null}
      {gitlabEnabled ? (
        <QuickAction
          icon={
            <span className="flex size-3 items-center justify-center rounded-[3px] bg-provider-gitlab text-[7px] font-bold text-white">
              G
            </span>
          }
          label="GitLab"
          title="launch a session from a GitLab issue"
          onClick={onOpenGitlab}
        />
      ) : null}
      {!gitlabEnabled ? (
        <QuickAction
          icon={<GitPullRequest size={12} className="text-merged" aria-hidden />}
          label="GitHub"
          title="review and act on pull requests across this workspace"
          onClick={onOpenGithub}
        />
      ) : null}
    </div>
  );
};
