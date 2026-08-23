import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConnectionState } from '@goodboy/types';
import { OPEN_WIZARD_EVENT } from '../../onboarding-store';
import { useOnboardingWizard } from './index';

let wizardDone = false;
let hydrated = true;
const providers: Array<{ connection: ProviderConnectionState }> = [];
const workspaces: Array<{ id: string }> = [];
let currentWorkspaceId: string | null = null;
let projects: Array<{ workspaceId: string }> = [];

vi.mock('../../onboarding-store', () => ({
  OPEN_WIZARD_EVENT: 'goodboy:open-onboarding-wizard',
  isWizardDone: () => wizardDone,
}));

vi.mock('../../../../store', () => ({
  useAppStore: (
    selector: (s: {
      providers: typeof providers;
      hydrated: boolean;
      currentWorkspaceId: string | null;
      projects: Array<{ workspaceId: string }>;
    }) => unknown,
  ) =>
    selector({
      providers,
      hydrated,
      currentWorkspaceId,
      projects,
    }),
  useWorkspaces: () => workspaces,
}));

function reset() {
  wizardDone = false;
  hydrated = true;
  providers.length = 0;
  workspaces.length = 0;
  currentWorkspaceId = null;
  projects = [];
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

  describe('workspace', () => {
    it('is null when no workspace exists', () => {
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.workspace).toBeNull();
      expect(result.current.workspaceId).toBeNull();
      expect(result.current.projectCount).toBe(0);
    });

    it('resolves the first workspace and counts its projects', () => {
      workspaces.push({ id: 'w1' });
      projects = [{ workspaceId: 'w1' }, { workspaceId: 'w2' }];
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.workspace).toBe(workspaces[0]);
      expect(result.current.workspaceId).toBe('w1');
      expect(result.current.projectCount).toBe(1);
    });

    it('prefers the active workspace', () => {
      workspaces.push({ id: 'w1' }, { id: 'w2' });
      currentWorkspaceId = 'w2';
      const { result } = renderHook(() => useOnboardingWizard());
      expect(result.current.workspace).toBe(workspaces[1]);
      expect(result.current.workspaceId).toBe('w2');
    });
  });
});
