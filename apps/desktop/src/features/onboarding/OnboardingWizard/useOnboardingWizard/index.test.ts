import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConnectionState } from '@goodboy/types';
import { OPEN_WIZARD_EVENT } from '../../onboarding-store';
import { useOnboardingWizard } from './index';

let wizardDone = false;
const providers: Array<{ connection: ProviderConnectionState }> = [];
const workspaces: Array<{ id: string }> = [];

vi.mock('../../onboarding-store', () => ({
  OPEN_WIZARD_EVENT: 'goodboy:open-onboarding-wizard',
  isWizardDone: () => wizardDone,
}));

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (s: { providers: typeof providers }) => unknown) =>
    selector({ providers }),
  useWorkspaces: () => workspaces,
}));

function reset() {
  wizardDone = false;
  providers.length = 0;
  workspaces.length = 0;
}

describe('useOnboardingWizard', () => {
  beforeEach(reset);
  afterEach(reset);

  it('opens on a genuine first run with nothing connected', () => {
    const { result } = renderHook(() => useOnboardingWizard());
    expect(result.current.open).toBe(true);
  });

  it('stays closed when a workspace already exists', () => {
    workspaces.push({ id: 'w1' });
    const { result } = renderHook(() => useOnboardingWizard());
    expect(result.current.open).toBe(false);
  });

  it('still opens when a provider is connected but no workspace exists yet', () => {
    providers.push({ connection: 'connected' });
    const { result } = renderHook(() => useOnboardingWizard());
    expect(result.current.open).toBe(true);
    expect(result.current.providersConnected).toBe(1);
  });

  it('stays closed once the wizard was finished', () => {
    wizardDone = true;
    const { result } = renderHook(() => useOnboardingWizard());
    expect(result.current.open).toBe(false);
  });

  it('reopens on the open-wizard event even after being done', () => {
    wizardDone = true;
    const { result } = renderHook(() => useOnboardingWizard());
    expect(result.current.open).toBe(false);
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT));
    });
    expect(result.current.open).toBe(true);
  });
});
