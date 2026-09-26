import { getSetting, setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';
import type { WizardStepId } from './OnboardingWizard/wizardSteps';

export type OnboardingStepId =
  'provider' | 'project' | 'codeHost' | 'taskManager' | 'firstSession' | 'profile';

export type OnboardingGroup = 'setup' | 'next';

export const ONBOARDING_STEPS: ReadonlyArray<{
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly why: string;
  readonly group: OnboardingGroup;
}> = [
  {
    id: 'provider',
    title: 'Connect an AI provider',
    why: 'Every agent runs through a provider you already use.',
    group: 'setup',
  },
  {
    id: 'project',
    title: 'Pick a project',
    why: 'A folder with code, or any folder with documents.',
    group: 'setup',
  },
  {
    id: 'codeHost',
    title: 'Connect a code host',
    why: 'Push branches and open pull requests on GitHub, GitLab or Bitbucket.',
    group: 'setup',
  },
  {
    id: 'taskManager',
    title: 'Connect a task manager',
    why: 'Start sessions from Linear or Jira issues.',
    group: 'setup',
  },
  {
    id: 'firstSession',
    title: 'Run your first session',
    why: 'Ticks when your first agent finishes a turn.',
    group: 'setup',
  },
  {
    id: 'profile',
    title: 'Tell agents about you',
    why: 'Your role and how much to explain. Optional.',
    group: 'next',
  },
];

const SETTING_PROGRESS = 'onboarding.progress';
const SETTING_COLLAPSED = 'onboarding.collapsed';
const SETTING_FINISHED = 'onboarding.finished';
const SETTING_WIZARD = 'onboarding.wizard';

export const OPEN_WIZARD_EVENT = 'goodboy:open-onboarding-wizard';

export type WizardMode = 'full' | 'setup' | 'single';

export type OpenWizardDetail = {
  readonly mode: WizardMode;
  readonly step?: WizardStepId;
};

const STEP_IDS: ReadonlyArray<OnboardingStepId> = ONBOARDING_STEPS.map((s) => s.id);

type OnboardingCache = {
  completed: ReadonlyArray<OnboardingStepId>;
  collapsed: boolean;
  finished: boolean;
  wizardDone: boolean;
};

const cache: OnboardingCache = {
  completed: [],
  collapsed: false,
  finished: false,
  wizardDone: false,
};

const isStepId = (value: string): value is OnboardingStepId => STEP_IDS.some((id) => id === value);

const LEGACY_STEP_IDS: Readonly<Record<string, OnboardingStepId>> = {
  workspace: 'project',
};

function parseCompleted(raw: string | null): ReadonlyArray<OnboardingStepId> {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return [];
    }
    const c = (parsed as { completed?: unknown }).completed;
    if (!Array.isArray(c)) {
      return [];
    }
    const ids = c.flatMap((x): ReadonlyArray<OnboardingStepId> => {
      if (typeof x !== 'string') {
        return [];
      }
      const id = LEGACY_STEP_IDS[x] ?? x;
      return isStepId(id) ? [id] : [];
    });
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

export const hydrateOnboardingFromDb = async (): Promise<void> => {
  const [rawProgress, rawCollapsed, rawFinished, rawWizard] = await Promise.all([
    getSetting(tauriDatabase, SETTING_PROGRESS),
    getSetting(tauriDatabase, SETTING_COLLAPSED),
    getSetting(tauriDatabase, SETTING_FINISHED),
    getSetting(tauriDatabase, SETTING_WIZARD),
  ]);
  cache.completed = parseCompleted(rawProgress);
  cache.collapsed = rawCollapsed === '1';
  cache.finished = rawFinished === '1';
  cache.wizardDone = rawWizard === 'done';
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
};

function flushProgress(): void {
  void setSetting(tauriDatabase, SETTING_PROGRESS, JSON.stringify({ completed: cache.completed }));
}

function flushFlag(key: string, on: boolean): void {
  void setSetting(tauriDatabase, key, on ? '1' : '0');
}

export const getCompleted = (): ReadonlyArray<OnboardingStepId> => {
  return cache.completed;
};

export const markStepComplete = (id: OnboardingStepId): void => {
  if (cache.completed.includes(id)) {
    return;
  }
  cache.completed = [...cache.completed, id];
  flushProgress();
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
};

export const isCollapsed = (): boolean => {
  return cache.collapsed;
};

export const collapse = (): void => {
  if (cache.collapsed) {
    return;
  }
  cache.collapsed = true;
  flushFlag(SETTING_COLLAPSED, true);
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
};

export const isFinished = (): boolean => {
  return cache.finished;
};

export const finish = (): void => {
  if (cache.finished) {
    return;
  }
  cache.finished = true;
  flushFlag(SETTING_FINISHED, true);
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
};

export const isWizardDone = (): boolean => {
  return cache.wizardDone;
};

export const finishWizard = (): void => {
  if (!cache.wizardDone) {
    cache.wizardDone = true;
    void setSetting(tauriDatabase, SETTING_WIZARD, 'done');
  }
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
};

export const reopenWizard = (mode: WizardMode = 'full', step?: WizardStepId): void => {
  if (cache.wizardDone) {
    cache.wizardDone = false;
    void setSetting(tauriDatabase, SETTING_WIZARD, '');
  }
  const detail: OpenWizardDetail = step === undefined ? { mode } : { mode, step };
  window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT, { detail }));
};

export const openWizardStep = (step: WizardStepId): void => {
  window.dispatchEvent(
    new CustomEvent<OpenWizardDetail>(OPEN_WIZARD_EVENT, { detail: { mode: 'single', step } }),
  );
};
