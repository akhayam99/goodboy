import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { BoardShellScene } from '../BoardShellScene';

const CLICK_DELAY_MS = 250;

type Props = {
  readonly theme: 'dark' | 'light';
};

export const SetupMenuScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
    useAppStore.setState((state) => ({
      providers: state.providers.map((provider) =>
        provider.id === 'anthropic' ? { ...provider, connection: 'connected' } : provider,
      ),
      githubStatus: null,
      workspaceIntegrations: {},
      agentTurnState: {},
      sessionPhaseRuns: {},
    }));
    const timer = window.setInterval(() => {
      const trigger = document.querySelector<HTMLElement>('[data-testid="goodboy-chip"]');
      if (trigger === null) {
        return;
      }
      trigger.click();
      window.clearInterval(timer);
    }, CLICK_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [theme]);
  return <BoardShellScene />;
};
