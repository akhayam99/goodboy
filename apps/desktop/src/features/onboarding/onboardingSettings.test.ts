// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  settings: new Map<string, string>(),
  setSetting: vi.fn(),
  failing: new Set<string>(),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../test/dbMock')).createDbMock({
    getSetting: (_db: unknown, key: string) =>
      Promise.resolve(db.settings.has(key) ? db.settings.get(key)! : null),
    setSetting: (_db: unknown, key: string, value: string) => {
      db.setSetting(key, value);
      if (db.failing.has(key)) {
        return Promise.reject(new Error('database is locked'));
      }
      db.settings.set(key, value);
      return Promise.resolve();
    },
  }),
);

vi.mock('../../shared/lib/db', () => ({ tauriDatabase: {} }));

import {
  enterWizardStep,
  finishWizard,
  getCompleted,
  getWizardState,
  getWizardStep,
  hydrateOnboardingFromDb,
  markStepComplete,
  OPEN_WIZARD_EVENT,
  pauseWizard,
  resumeSetup,
} from './onboardingSettings';

const listeners: Array<(event: Event) => void> = [];

const openDetails = (): Array<unknown> => {
  const details: Array<unknown> = [];
  const listener = (event: Event) => {
    details.push(event instanceof CustomEvent ? event.detail : null);
  };
  listeners.push(listener);
  window.addEventListener(OPEN_WIZARD_EVENT, listener);
  return details;
};

beforeEach(async () => {
  db.settings.clear();
  db.failing.clear();
  db.setSetting.mockClear();
  await hydrateOnboardingFromDb();
});
afterEach(() => {
  listeners
    .splice(0)
    .forEach((listener) => window.removeEventListener(OPEN_WIZARD_EVENT, listener));
  vi.restoreAllMocks();
});

describe('onboarding settings wizard flag', () => {
  it('hydrates wizardDone=true only when the stored value is "done"', async () => {
    db.settings.set('onboarding.wizard', 'done');
    await hydrateOnboardingFromDb();
    expect(getWizardState()).toBe('done');
  });

  it('treats any non-"done" stored value as not finished', async () => {
    db.settings.set('onboarding.wizard', '');
    await hydrateOnboardingFromDb();
    expect(getWizardState()).not.toBe('done');
  });

  it('marks the wizard done and persists "done"', async () => {
    await finishWizard();
    expect(getWizardState()).toBe('done');
    expect(db.setSetting).toHaveBeenCalledWith('onboarding.wizard', 'done');
  });

  it('is idempotent: finishing twice persists only once', async () => {
    await finishWizard();
    db.setSetting.mockClear();
    await finishWizard();
    expect(db.setSetting).not.toHaveBeenCalled();
  });

  it('resuming setup resets the done flag and persists the cleared value', async () => {
    await finishWizard();
    db.setSetting.mockClear();
    resumeSetup({ hasWorkspace: true });
    await vi.waitFor(() => expect(getWizardState()).not.toBe('done'));
    expect(db.setSetting).toHaveBeenCalledWith('onboarding.wizard', '');
  });

  it('resuming setup dispatches the open-wizard event', () => {
    const spy = vi.fn();
    window.addEventListener(OPEN_WIZARD_EVENT, spy);
    resumeSetup({ hasWorkspace: true });
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener(OPEN_WIZARD_EVENT, spy);
  });

  it('resuming setup skips the db write when the wizard was never finished', () => {
    resumeSetup({ hasWorkspace: true });
    expect(db.setSetting).not.toHaveBeenCalled();
  });
});

describe('onboarding settings setup progress', () => {
  it('hydrates a paused setup and its step', async () => {
    db.settings.set('onboarding.wizard', 'later');
    db.settings.set('onboarding.step', 'workspace');
    await hydrateOnboardingFromDb();
    expect(getWizardState()).toBe('later');
    expect(getWizardStep()).toBe('workspace');
  });

  it('moves a setup paused on the old Tools step to First session', async () => {
    db.settings.set('onboarding.wizard', 'later');
    db.settings.set('onboarding.step', 'tools');
    await hydrateOnboardingFromDb();
    expect(getWizardStep()).toBe('first-session');
  });

  it('moves a step saved on the old Welcome splash to Agents', async () => {
    db.settings.set('onboarding.step', 'welcome');
    await hydrateOnboardingFromDb();
    expect(getWizardStep()).toBe('agents');
  });

  it('drops a step it does not know', async () => {
    db.settings.set('onboarding.step', 'code-host');
    await hydrateOnboardingFromDb();
    expect(getWizardStep()).toBeNull();
  });

  it('writes the step on entering it', async () => {
    await enterWizardStep({ step: 'workspace' });
    expect(db.setSetting).toHaveBeenCalledWith('onboarding.step', 'workspace');
    expect(getWizardStep()).toBe('workspace');
  });

  it('pauses at the current step', async () => {
    await enterWizardStep({ step: 'first-session' });
    await pauseWizard();
    expect(db.settings.get('onboarding.wizard')).toBe('later');
    expect(db.settings.get('onboarding.step')).toBe('first-session');
    expect(getWizardState()).toBe('later');
    expect(getWizardState()).not.toBe('done');
  });

  it('resumes from the last written step', async () => {
    await enterWizardStep({ step: 'first-session' });
    await pauseWizard();
    await hydrateOnboardingFromDb();
    const details = openDetails();
    resumeSetup({ hasWorkspace: true });
    expect(details).toEqual([{ mode: 'setup', step: 'first-session' }]);
    await vi.waitFor(() => expect(getWizardState()).toBe('open'));
    expect(db.settings.get('onboarding.wizard')).toBe('');
  });

  it('resumes at Workspace when the saved step needs a workspace that is gone', async () => {
    await enterWizardStep({ step: 'first-session' });
    const details = openDetails();
    resumeSetup({ hasWorkspace: false });
    expect(details).toEqual([{ mode: 'setup', step: 'workspace' }]);
  });

  it('resumes at the row the user picked', () => {
    const details = openDetails();
    resumeSetup({ step: 'agents', hasWorkspace: true });
    expect(details).toEqual([{ mode: 'setup', step: 'agents' }]);
  });

  it('keeps the last written step when a later write fails, so resume falls back to it', async () => {
    await enterWizardStep({ step: 'workspace' });
    db.failing.add('onboarding.step');
    await expect(enterWizardStep({ step: 'first-session' })).rejects.toThrow('database is locked');
    expect(getWizardStep()).toBe('workspace');
    db.failing.clear();
    await enterWizardStep({ step: 'first-session' });
    expect(getWizardStep()).toBe('first-session');
  });

  it('keeps setup open when the pause cannot be written', async () => {
    db.failing.add('onboarding.wizard');
    await expect(pauseWizard()).rejects.toThrow('database is locked');
    expect(getWizardState()).toBe('open');
  });

  it('writes in order, so the last step entered is the one kept', async () => {
    void enterWizardStep({ step: 'agents' });
    void enterWizardStep({ step: 'workspace' });
    await enterWizardStep({ step: 'first-session' });
    const steps = db.setSetting.mock.calls
      .filter(([key]) => key === 'onboarding.step')
      .map(([, value]) => value);
    expect(steps).toEqual(['agents', 'workspace', 'first-session']);
    expect(db.settings.get('onboarding.step')).toBe('first-session');
  });

  it('maps the old checklist ids to the three steps on hydrate and drops the old Tools row', async () => {
    db.settings.set(
      'onboarding.progress',
      JSON.stringify({
        completed: ['provider', 'project', 'codeHost', 'taskManager', 'firstSession', 'profile'],
      }),
    );
    await hydrateOnboardingFromDb();
    expect(getCompleted()).toEqual(['agents', 'workspace', 'first-session', 'profile']);
  });

  it('drops a stored tools row from the four step list and keeps the rest', async () => {
    db.settings.set(
      'onboarding.progress',
      JSON.stringify({ completed: ['agents', 'workspace', 'tools'] }),
    );
    await hydrateOnboardingFromDb();
    expect(getCompleted()).toEqual(['agents', 'workspace']);
  });

  it('persists a completed step under its new id', async () => {
    markStepComplete('workspace');
    await vi.waitFor(() =>
      expect(db.setSetting).toHaveBeenCalledWith(
        'onboarding.progress',
        JSON.stringify({ completed: ['workspace'] }),
      ),
    );
  });
});
