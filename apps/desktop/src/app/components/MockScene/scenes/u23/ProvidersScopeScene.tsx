import { useEffect } from 'react';
import { SettingsFrame } from '../audit/SettingsFrame';
import { SETTINGS_WORKSPACE_ID } from '../audit/settingsSeed';
import { seedPolicyScene } from '../providerPolicySeed';

const OPEN_DELAY_MS = 400;

const seedProvidersScope = (): void => {
  seedPolicyScene({ workspaceId: SETTINGS_WORKSPACE_ID });
};

export const ProvidersScopeScene = () => {
  useEffect(() => {
    const id = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);
  return <SettingsFrame focus={{ scope: 'providers' }} seed={seedProvidersScope} />;
};
