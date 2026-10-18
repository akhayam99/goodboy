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
  isWizardDone,
  markStepComplete,
  OPEN_WIZARD_EVENT,
  pauseWizard,
  reopenWizard,
  resumeSetup,
} from './onboarding-store';

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

describe('onboarding-store wizard flag', () => {
  it('hydrates wizardDone=true only when the stored value is "done"', async () => {
    db.settings.set('onboarding.wizard', 'done');
    await hydrateOnboardingFromDb();
    expect(isWizardDone()).toBe(true);
  });

  it('treats any non-"done" stored value as not finished', async () => {
    db.settings.set('onboarding.wizard', '');
    await hydrateOnboardingFromDb();
    expect(isWizardDone()).toBe(false);
  });

  it('marks the wizard done and persists "done"', async () => {
    await finishWizard();
    expect(isWizardDone()).toBe(true);
    expect(db.setSetting).toHaveBeenCalledWith('onboarding.wizard', 'done');
  });

  it('is idempotent: finishing twice persists only once', async () => {
    await finishWizard();
    db.setSetting.mockClear();
    await finishWizard();
    expect(db.setSetting).not.toHaveBeenCalled();
  });

  it('reopenWizard resets the done flag and persists the cleared value', async () => {
    await finishWizard();
    db.setSetting.mockClear();
    reopenWizard();
    await vi.waitFor(() => expect(isWizardDone()).toBe(false));
    expect(db.setSetting).toHaveBeenCalledWith('onboarding.wizard', '');
  });

  it('reopenWizard dispatches the open-wizard event', () => {
    const spy = vi.fn();
    window.addEventListener(OPEN_WIZARD_EVENT, spy);
    reopenWizard();
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener(OPEN_WIZARD_EVENT, spy);
  });

  it('reopenWizard skips the db write when the wizard was never finished', () => {
    reopenWizard();
    expect(db.setSetting).not.toHaveBeenCalled();
  });

  it('reopenWizard still dispatches the event when nothing was persisted', () => {
    const spy = vi.fn();
    window.addEventListener(OPEN_WIZARD_EVENT, spy);
    reopenWizard();
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener(OPEN_WIZARD_EVENT, spy);
  });

  it('reopenWizard defaults to full mode in the event detail', () => {
    let detail: unknown;
    const spy = (e: Event) => {
      detail = (e as CustomEvent).detail;
    };
    window.addEventListener(OPEN_WIZARD_EVENT, spy);
    reopenWizard();
    window.removeEventListener(OPEN_WIZARD_EVENT, spy);
    expect(detail).toEqual({ mode: 'full' });
  });

  it('reopenWizard forwards the requested setup mode in the event detail', () => {
    let detail: unknown;
    const spy = (e: Event) => {
      detail = (e as CustomEvent).detail;
    };
    window.addEventListener(OPEN_WIZARD_EVENT, spy);
    reopenWizard('setup');
    window.removeEventListener(OPEN_WIZARD_EVENT, spy);
    expect(detail).toEqual({ mode: 'setup' });
  });
});

describe('onboarding-store setup progress', () => {
  it('hydrates a paused setup and its step', async () => {
    db.settings.set('onboarding.wizard', 'later');
    db.settings.set('onboarding.step', 'tools');
    await hydrateOnboardingFromDb();
    expect(getWizardState()).toBe('later');
    expect(getWizardStep()).toBe('tools');
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
    await enterWizardStep({ step: 'tools' });
    await pauseWizard();
    expect(db.settings.get('onboarding.wizard')).toBe('later');
    expect(db.settings.get('onboarding.step')).toBe('tools');
    expect(getWizardState()).toBe('later');
    expect(isWizardDone()).toBe(false);
  });

  it('resumes from the last written step', async () => {
    await enterWizardStep({ step: 'tools' });
    await pauseWizard();
    await hydrateOnboardingFromDb();
    const details = openDetails();
    resumeSetup({ hasWorkspace: true });
    expect(details).toEqual([{ mode: 'setup', step: 'tools' }]);
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
    await expect(enterWizardStep({ step: 'tools' })).rejects.toThrow('database is locked');
    expect(getWizardStep()).toBe('workspace');
    db.failing.clear();
    await enterWizardStep({ step: 'tools' });
    expect(getWizardStep()).toBe('tools');
  });

  it('keeps setup open when the pause cannot be written', async () => {
    db.failing.add('onboarding.wizard');
    await expect(pauseWizard()).rejects.toThrow('database is locked');
    expect(getWizardState()).toBe('open');
  });

  it('writes in order, so the last step entered is the one kept', async () => {
    void enterWizardStep({ step: 'agents' });
    void enterWizardStep({ step: 'workspace' });
    await enterWizardStep({ step: 'tools' });
    const steps = db.setSetting.mock.calls
      .filter(([key]) => key === 'onboarding.step')
      .map(([, value]) => value);
    expect(steps).toEqual(['agents', 'workspace', 'tools']);
    expect(db.settings.get('onboarding.step')).toBe('tools');
  });

  it('maps the old checklist ids to the four steps on hydrate', async () => {
    db.settings.set(
      'onboarding.progress',
      JSON.stringify({
        completed: ['provider', 'project', 'codeHost', 'taskManager', 'firstSession', 'profile'],
      }),
    );
    await hydrateOnboardingFromDb();
    expect(getCompleted()).toEqual(['agents', 'workspace', 'tools', 'first-session', 'profile']);
  });

  it('persists a completed step under its new id', async () => {
    markStepComplete('tools');
    await vi.waitFor(() =>
      expect(db.setSetting).toHaveBeenCalledWith(
        'onboarding.progress',
        JSON.stringify({ completed: ['tools'] }),
      ),
    );
  });
});
