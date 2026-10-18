import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConnectionState } from '@goodboy/types';
import type { WizardState } from '../../onboarding-store';
import { useOnboardingWizard } from './index';

const OPEN_EVENT = 'goodboy:open-onboarding-wizard';
const PROGRESS_EVENT = 'goodboy:onboarding-progress';

let wizardState: WizardState = 'open';
let savedStep: string | null = null;
let hydrated = true;
const providers: Array<{ connection: ProviderConnectionState }> = [];
const workspaces: Array<{ id: string }> = [];
let currentWorkspaceId: string | null = null;
let projects: Array<{ workspaceId: string }> = [];

vi.mock('../../onboarding-store', () => ({
  OPEN_WIZARD_EVENT: 'goodboy:open-onboarding-wizard',
  ONBOARDING_PROGRESS_EVENT: 'goodboy:onboarding-progress',
  getWizardState: () => wizardState,
  getWizardStep: () => savedStep,
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

const reset = () => {
  wizardState = 'open';
  savedStep = null;
  hydrated = true;
  providers.length = 0;
  workspaces.length = 0;
  currentWorkspaceId = null;
  projects = [];
};

type RenderParams = {
  readonly isMainWindow?: boolean;
};

const renderWizard = ({ isMainWindow = true }: RenderParams = {}) =>
  renderHook(() => useOnboardingWizard({ isMainWindow }));

const openEvent = (detail?: unknown) =>
  act(() => {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }));
  });

describe('useOnboardingWizard', () => {
  beforeEach(reset);
  afterEach(reset);

  describe('open/close decision', () => {
    it('opens on a genuine first run with nothing connected', () => {
      const { result } = renderWizard();
      expect(result.current.isOpen).toBe(true);
    });

    it('stays closed when a workspace already exists and no step was ever written', () => {
      workspaces.push({ id: 'w1' });
      const { result } = renderWizard();
      expect(result.current.isOpen).toBe(false);
    });

    it('still opens when a provider is connected but no workspace exists yet', () => {
      providers.push({ connection: 'connected' });
      const { result } = renderWizard();
      expect(result.current.isOpen).toBe(true);
      expect(result.current.providersConnected).toBe(1);
    });

    it('stays closed once setup is done', () => {
      wizardState = 'done';
      const { result } = renderWizard();
      expect(result.current.isOpen).toBe(false);
    });

    it('stays closed while setup is paused, even with no workspace', () => {
      wizardState = 'later';
      savedStep = 'agents';
      const { result } = renderWizard();
      expect(result.current.isOpen).toBe(false);
    });

    it('stays closed before the store hydrates, even with no workspace', () => {
      hydrated = false;
      const { result } = renderWizard();
      expect(result.current.isOpen).toBe(false);
    });

    it('does not open once a workspace arrives during hydration', () => {
      hydrated = false;
      const { result, rerender } = renderWizard();
      workspaces.push({ id: 'w1' });
      hydrated = true;
      rerender();
      expect(result.current.isOpen).toBe(false);
    });

    it('opens once hydration completes on a genuine first run', () => {
      hydrated = false;
      const { result, rerender } = renderWizard();
      expect(result.current.isOpen).toBe(false);
      hydrated = true;
      rerender();
      expect(result.current.isOpen).toBe(true);
    });

    it('stays open after a workspace is created post-decision', () => {
      const { result, rerender } = renderWizard();
      workspaces.push({ id: 'w1' });
      rerender();
      expect(result.current.isOpen).toBe(true);
    });

    it('opens if the last workspace is removed after hydration (guard latches only on open)', () => {
      workspaces.push({ id: 'w1' });
      const { result, rerender } = renderWizard();
      expect(result.current.isOpen).toBe(false);
      workspaces.length = 0;
      rerender();
      expect(result.current.isOpen).toBe(true);
    });

    it('reopens on the open-wizard event even after being done', () => {
      wizardState = 'done';
      const { result } = renderWizard();
      openEvent();
      expect(result.current.isOpen).toBe(true);
    });

    it('opens through an explicit event even after a workspace exists', () => {
      workspaces.push({ id: 'w1' });
      const { result } = renderWizard();
      openEvent();
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('resume', () => {
    it('resumes at Tools after relaunch', () => {
      workspaces.push({ id: 'w1' });
      currentWorkspaceId = 'w1';
      savedStep = 'tools';
      const { result } = renderWizard();
      expect(result.current.isOpen).toBe(true);
      expect(result.current.mode).toBe('setup');
      expect(result.current.start).toBe('tools');
    });

    it('resumes from Home, with workspaces and none open', () => {
      workspaces.push({ id: 'w1' }, { id: 'w2' });
      savedStep = 'first-session';
      const { result } = renderWizard();
      expect(result.current.isOpen).toBe(true);
      expect(result.current.start).toBe('first-session');
    });

    it('resumes at Workspace when the saved step needs a workspace that is gone', () => {
      savedStep = 'tools';
      const { result } = renderWizard();
      expect(result.current.mode).toBe('setup');
      expect(result.current.start).toBe('workspace');
    });

    it('does not open in a second window', () => {
      savedStep = 'tools';
      const { result } = renderWizard({ isMainWindow: false });
      expect(result.current.isOpen).toBe(false);
    });

    it('ignores the open event in a second window', () => {
      const { result } = renderWizard({ isMainWindow: false });
      openEvent({ mode: 'setup', step: 'tools' });
      expect(result.current.isOpen).toBe(false);
    });

    it('closes when setup is finished from elsewhere', () => {
      const { result } = renderWizard();
      wizardState = 'done';
      act(() => {
        window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('closes on close and never reopens on its own', () => {
      const { result, rerender } = renderWizard();
      act(() => result.current.close());
      rerender();
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('mode', () => {
    it('defaults to full on a first-run open', () => {
      const { result } = renderWizard();
      expect(result.current.mode).toBe('full');
      expect(result.current.start).toBeNull();
    });

    it('enters setup mode when the open event requests it', () => {
      wizardState = 'done';
      workspaces.push({ id: 'w1' });
      const { result } = renderWizard();
      openEvent({ mode: 'setup', step: 'agents' });
      expect(result.current.isOpen).toBe(true);
      expect(result.current.mode).toBe('setup');
      expect(result.current.start).toBe('agents');
    });

    it('ignores a setup request while the wizard is already open', () => {
      const { result } = renderWizard();
      openEvent({ mode: 'setup' });
      expect(result.current.mode).toBe('full');
      expect(result.current.isOpen).toBe(true);
    });

    it('opens one step on its own when the checklist asks for it', () => {
      wizardState = 'done';
      workspaces.push({ id: 'w1' });
      const { result } = renderWizard();
      openEvent({ mode: 'single', step: 'tools' });
      expect(result.current.mode).toBe('single');
      expect(result.current.start).toBe('tools');
    });

    it('reopens in full mode when the event omits a mode', () => {
      wizardState = 'done';
      workspaces.push({ id: 'w1' });
      const { result } = renderWizard();
      openEvent();
      expect(result.current.mode).toBe('full');
    });
  });

  describe('workspace', () => {
    it('is null when no workspace exists', () => {
      const { result } = renderWizard();
      expect(result.current.workspace).toBeNull();
      expect(result.current.workspaceId).toBeNull();
      expect(result.current.projectCount).toBe(0);
    });

    it('resolves the first workspace and counts its projects', () => {
      workspaces.push({ id: 'w1' });
      projects = [{ workspaceId: 'w1' }, { workspaceId: 'w2' }];
      const { result } = renderWizard();
      expect(result.current.workspace).toBe(workspaces[0]);
      expect(result.current.projectCount).toBe(1);
    });

    it('prefers the active workspace', () => {
      workspaces.push({ id: 'w1' }, { id: 'w2' });
      currentWorkspaceId = 'w2';
      const { result } = renderWizard();
      expect(result.current.workspaceId).toBe('w2');
    });
  });
});
