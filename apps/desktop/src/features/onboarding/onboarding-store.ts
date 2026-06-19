import { getSetting, setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';

export type OnboardingStepId =
  | 'workspace'
  | 'codeHost'
  | 'tools'
  | 'session'
  | 'agent'
  | 'plan'
  | 'palette';

export type OnboardingGroup = 'setup' | 'build';

export const ONBOARDING_STEPS: ReadonlyArray<{
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly why: string;
  readonly group: OnboardingGroup;
}> = [
  {
    id: 'workspace',
    title: 'Connect a workspace',
    why: 'Point Goodboy at a git repo, every session worktree lives off it.',
    group: 'setup',
  },
  {
    id: 'codeHost',
    title: 'Connect a code host',
    why: 'Link GitHub or GitLab so agents can read PRs, branches, and reviews.',
    group: 'setup',
  },
  {
    id: 'tools',
    title: 'Connect your tools',
    why: 'Wire Linear or Sentry to pull issues and errors into context.',
    group: 'setup',
  },
  {
    id: 'session',
    title: 'Create your first session',
    why: 'A session = one goal on its own worktree + branch. Pick something concrete.',
    group: 'build',
  },
  {
    id: 'agent',
    title: 'Create your first agent',
    why: 'Sessions host agents (planner, scout, implementer…). Create the one that fits the work.',
    group: 'build',
  },
  {
    id: 'plan',
    title: 'Make your first plan',
    why: 'Spawn a planner, it emits a structured plan you can hand off to an implementer.',
    group: 'build',
  },
  {
    id: 'palette',
    title: 'Open the command palette',
    why: '⌘K. Navigate workspaces, sessions, and agents, everything from one input.',
    group: 'build',
  },
];

const SETTING_PROGRESS = 'onboarding.progress';
const SETTING_COLLAPSED = 'onboarding.collapsed';
const SETTING_FINISHED = 'onboarding.finished';
const SETTING_WIZARD = 'onboarding.wizard';

export const OPEN_WIZARD_EVENT = 'goodboy:open-onboarding-wizard';

export type WizardMode = 'full' | 'setup';

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
    return c.filter(
      (x): x is OnboardingStepId =>
        typeof x === 'string' && STEP_IDS.includes(x as OnboardingStepId),
    );
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

export const reopen = (): void => {
  if (!cache.collapsed) {
    return;
  }
  cache.collapsed = false;
  flushFlag(SETTING_COLLAPSED, false);
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
  if (cache.wizardDone) {
    return;
  }
  cache.wizardDone = true;
  void setSetting(tauriDatabase, SETTING_WIZARD, 'done');
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
};

export const reopenWizard = (mode: WizardMode = 'full'): void => {
  if (cache.wizardDone) {
    cache.wizardDone = false;
    void setSetting(tauriDatabase, SETTING_WIZARD, '');
  }
  window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT, { detail: { mode } }));
};
