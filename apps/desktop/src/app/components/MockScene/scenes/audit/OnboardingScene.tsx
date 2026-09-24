import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../Toast';
import { OnboardingWizard } from '../../../../../features/onboarding/OnboardingWizard';
import { OPEN_WIZARD_EVENT } from '../../../../../features/onboarding/onboarding-store';
import { useAppStore } from '../../../../../store';
import { SETTINGS_PROVIDERS, SETTINGS_WORKSPACE, seedSettingsBase } from './settingsSeed';
import { sceneParam } from './sceneParams';

const STEPS = Number(sceneParam({ key: 'step' }) ?? '0');
const HAS_WORKSPACE = sceneParam({ key: 'ws' }) !== '0';
const HAS_NO_PROVIDERS = sceneParam({ key: 'providers' }) === '0';

const CTA_LABELS = ['Get started', 'Continue', 'Create workspace'];

const clickCta = (): void => {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  );
  const target = buttons
    .reverse()
    .find((button) => CTA_LABELS.includes(button.textContent?.trim() ?? ''));
  target?.click();
};

const DISCONNECTED_PROVIDERS = SETTINGS_PROVIDERS.map((provider) => ({
  ...provider,
  connection: provider.id === 'anthropic' ? 'installed_disconnected' : provider.connection,
  identity: null,
}));

const seedOnboarding = (): void => {
  seedSettingsBase();
  useAppStore.setState({
    hydrated: true,
    renameWorkspace: async () => SETTINGS_WORKSPACE,
    updateWorkspaceProfile: async () => SETTINGS_WORKSPACE,
  });
  if (!HAS_WORKSPACE) {
    useAppStore.setState({ workspaces: [], currentWorkspaceId: null, projects: [] });
  }
  if (HAS_NO_PROVIDERS) {
    useAppStore.setState({ providers: DISCONNECTED_PROVIDERS });
  }
};

export const OnboardingScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedOnboarding();
    setIsReady(true);
  }, []);
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const opener = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT, { detail: { mode: 'full' } }));
    }, 100);
    const clicks = Array.from({ length: STEPS }, (_, index) =>
      window.setTimeout(clickCta, 600 + index * 600),
    );
    return () => [opener, ...clicks].forEach((timer) => window.clearTimeout(timer));
  }, [isReady]);
  if (!isReady) {
    return null;
  }
  return (
    <ToastProvider>
      <main className="h-screen bg-background text-foreground">
        <OnboardingWizard />
      </main>
    </ToastProvider>
  );
};
