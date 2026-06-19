import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConnectionState } from '@goodboy/types';
import { OPEN_WIZARD_EVENT } from '../../onboarding-store';
import { useOnboardingWizard } from './index';

let wizardDone = false;
let hydrated = true;
const providers: Array<{ connection: ProviderConnectionState }> = [];
const workspaces: Array<{ id: string }> = [];
let workspaceIntegrations: Record<string, Array<{ provider: string }>> = {};

const { ghStatusMock } = vi.hoisted(() => ({
  ghStatusMock: vi.fn(async () => ({ scoped: false }) as unknown),
}));

vi.mock('../../onboarding-store', () => ({
  OPEN_WIZARD_EVENT: 'goodboy:open-onboarding-wizard',
  isWizardDone: () => wizardDone,
}));

vi.mock('../../../github/github', () => ({
  ghStatus: ghStatusMock,
}));

vi.mock('../../../../store', () => ({
  useAppStore: (
    selector: (s: {
      providers: typeof providers;
      hydrated: boolean;
      workspaceIntegrations: typeof workspaceIntegrations;
    }) => unknown,
  ) => selector({ providers, hydrated, workspaceIntegrations }),
  useWorkspaces: () => workspaces,
}));

function reset() {
  wizardDone = false;
  hydrated = true;
  providers.length = 0;
  workspaces.length = 0;
  workspaceIntegrations = {};
  ghStatusMock.mockReset();
  ghStatusMock.mockResolvedValue({ scoped: false });
}

describe('useOnboardingWizard', () => {
  beforeEach(reset);
  afterEach(reset);

  describe('open/close decision', () => {
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

    it('stays closed before the store hydrates, even with no workspace', () => {
      hydrated = false;
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.open).toBe(false);
    });

    it('does not open once a workspace arrives during hydration', () => {
      hydrated = false;
      const { result, rerender } = renderHook(() => useOnboardingWizard());
      expect(result.current.open).toBe(false);
      workspaces.push({ id: 'w1' });
      hydrated = true;
      rerender();
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

    it('opens once hydration completes on a genuine first run', () => {
      hydrated = false;
      const { result, rerender } = renderHook(() => useOnboardingWizard());
      expect(result.current.open).toBe(false);
      hydrated = true;
      rerender();
      expect(result.current.open).toBe(true);
    });

    it('does not reopen after a workspace is created post-decision', () => {
      const { result, rerender } = renderHook(() => useOnboardingWizard());
      expect(result.current.open).toBe(true);
      workspaces.push({ id: 'w1' });
      rerender();
      expect(result.current.open).toBe(true);
    });

    it('opens if the last workspace is removed after hydration (guard latches only on open)', () => {
      workspaces.push({ id: 'w1' });
      const { result, rerender } = renderHook(() => useOnboardingWizard());
      expect(result.current.open).toBe(false);
      workspaces.length = 0;
      rerender();
      expect(result.current.open).toBe(true);
    });

    it('keeps the wizard open through an explicit event even after a workspace exists', () => {
      workspaces.push({ id: 'w1' });
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.open).toBe(false);
      act(() => {
        window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT));
      });
      expect(result.current.open).toBe(true);
    });
  });

  describe('mode', () => {
    it('defaults to full on a first-run open', () => {
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.open).toBe(true);
      expect(result.current.mode).toBe('full');
    });

    it('enters setup mode when the open event requests it', () => {
      wizardDone = true;
      workspaces.push({ id: 'w1' });
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.open).toBe(false);
      act(() => {
        window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT, { detail: { mode: 'setup' } }));
      });
      expect(result.current.open).toBe(true);
      expect(result.current.mode).toBe('setup');
    });

    it('ignores a setup request while the wizard is already open', () => {
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.open).toBe(true);
      expect(result.current.mode).toBe('full');
      act(() => {
        window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT, { detail: { mode: 'setup' } }));
      });
      expect(result.current.mode).toBe('full');
      expect(result.current.open).toBe(true);
    });

    it('reopens in full mode when the event omits a mode', () => {
      wizardDone = true;
      workspaces.push({ id: 'w1' });
      const { result } = renderHook(() => useOnboardingWizard());
      act(() => {
        window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT));
      });
      expect(result.current.mode).toBe('full');
    });
  });

  describe('workspaceId', () => {
    it('is null when no workspace exists', () => {
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.workspaceId).toBeNull();
    });

    it('resolves to the first workspace id', () => {
      workspaces.push({ id: 'w1' });
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.workspaceId).toBe('w1');
    });
  });

  describe('hasCodeHost', () => {
    it('is false without a workspace and never queries gh status', () => {
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.hasCodeHost).toBe(false);
      expect(ghStatusMock).not.toHaveBeenCalled();
    });

    it('is true when GitLab is connected for the workspace', () => {
      workspaces.push({ id: 'w1' });
      workspaceIntegrations = { w1: [{ provider: 'gitlab' }] };
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.hasCodeHost).toBe(true);
      expect(result.current.gitlabConnected).toBe(true);
      expect(result.current.githubConnected).toBe(false);
    });

    it('becomes true once gh status reports a scoped token', async () => {
      workspaces.push({ id: 'w1' });
      ghStatusMock.mockResolvedValue({ scoped: true });
      const { result } = renderHook(() => useOnboardingWizard());
      await waitFor(() => expect(result.current.hasCodeHost).toBe(true));
      expect(result.current.githubConnected).toBe(true);
      expect(ghStatusMock).toHaveBeenCalledWith('w1');
    });

    it('stays false when gh status check rejects', async () => {
      workspaces.push({ id: 'w1' });
      ghStatusMock.mockRejectedValue(new Error('offline'));
      const { result } = renderHook(() => useOnboardingWizard());
      await waitFor(() => expect(ghStatusMock).toHaveBeenCalledWith('w1'));
      expect(result.current.hasCodeHost).toBe(false);
    });
  });

  describe('hasLinear / hasSentry', () => {
    it('are both false without a workspace', () => {
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.hasLinear).toBe(false);
      expect(result.current.hasSentry).toBe(false);
    });

    it('flags Linear independently of Sentry', () => {
      workspaces.push({ id: 'w1' });
      workspaceIntegrations = { w1: [{ provider: 'linear' }] };
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.hasLinear).toBe(true);
      expect(result.current.hasSentry).toBe(false);
    });

    it('flags Sentry independently of Linear', () => {
      workspaces.push({ id: 'w1' });
      workspaceIntegrations = { w1: [{ provider: 'sentry' }] };
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.hasSentry).toBe(true);
      expect(result.current.hasLinear).toBe(false);
    });

    it('leaves both false when only a code host is connected', () => {
      workspaces.push({ id: 'w1' });
      workspaceIntegrations = { w1: [{ provider: 'gitlab' }] };
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.hasLinear).toBe(false);
      expect(result.current.hasSentry).toBe(false);
    });
  });

  describe('refreshGithubStatus', () => {
    it('re-queries gh status and flips hasCodeHost after a fresh connect', async () => {
      workspaces.push({ id: 'w1' });
      const { result } = renderHook(() => useOnboardingWizard());
      await waitFor(() => expect(ghStatusMock).toHaveBeenCalledWith('w1'));
      expect(result.current.hasCodeHost).toBe(false);
      ghStatusMock.mockResolvedValue({ scoped: true });
      act(() => {
        result.current.refreshGithubStatus();
      });
      await waitFor(() => expect(result.current.hasCodeHost).toBe(true));
    });
  });
});
