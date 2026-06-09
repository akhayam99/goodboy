/**
 * Onboarding progress is auto-detected from store state and persisted to
 * the DB `settings` table so completion is monotonic across reloads AND
 * survives a localStorage wipe / reinstall. An in-memory cache keeps the
 * sync API the existing callers depend on; the cache is hydrated at boot
 * by `hydrateOnboardingFromDb` (called from app boot) and mutations are
 * flushed to DB best-effort.
 */
import { getSetting, setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';

export type OnboardingStepId = 'workspace' | 'session' | 'agent' | 'plan' | 'palette';

export const ONBOARDING_STEPS: ReadonlyArray<{
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly why: string;
}> = [
  {
    id: 'workspace',
    title: 'Connect a workspace',
    why: 'Point Goodboy at a git repo, every session worktree lives off it.',
  },
  {
    id: 'session',
    title: 'Create your first session',
    why: 'A session = one goal on its own worktree + branch. Pick something concrete.',
  },
  {
    id: 'agent',
    title: 'Create your first agent',
    why: 'Sessions host agents (planner, scout, implementer…). Create the one that fits the work.',
  },
  {
    id: 'plan',
    title: 'Make your first plan',
    why: 'Spawn a planner, it emits a structured plan you can hand off to an implementer.',
  },
  {
    id: 'palette',
    title: 'Open the command palette',
    why: '⌘K. Navigate workspaces, sessions, and agents, everything from one input.',
  },
];

const SETTING_PROGRESS = 'onboarding.progress';
const SETTING_COLLAPSED = 'onboarding.collapsed';
const SETTING_FINISHED = 'onboarding.finished';
const SETTING_WIZARD = 'onboarding.wizard';

export const OPEN_WIZARD_EVENT = 'goodboy:open-onboarding-wizard';

const STEP_IDS: ReadonlyArray<OnboardingStepId> = [
  'workspace',
  'session',
  'agent',
  'plan',
  'palette',
];

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
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return [];
    const c = (parsed as { completed?: unknown }).completed;
    if (!Array.isArray(c)) return [];
    return c.filter(
      (x): x is OnboardingStepId =>
        typeof x === 'string' && STEP_IDS.includes(x as OnboardingStepId),
    );
  } catch {
    return [];
  }
}

export async function hydrateOnboardingFromDb(): Promise<void> {
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
}

function flushProgress(): void {
  void setSetting(tauriDatabase, SETTING_PROGRESS, JSON.stringify({ completed: cache.completed }));
}

function flushFlag(key: string, on: boolean): void {
  void setSetting(tauriDatabase, key, on ? '1' : '0');
}

export function getCompleted(): ReadonlyArray<OnboardingStepId> {
  return cache.completed;
}

export function markStepComplete(id: OnboardingStepId): void {
  if (cache.completed.includes(id)) return;
  cache.completed = [...cache.completed, id];
  flushProgress();
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
}

export function isCollapsed(): boolean {
  return cache.collapsed;
}

export function collapse(): void {
  if (cache.collapsed) return;
  cache.collapsed = true;
  flushFlag(SETTING_COLLAPSED, true);
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
}

export function reopen(): void {
  if (!cache.collapsed) return;
  cache.collapsed = false;
  flushFlag(SETTING_COLLAPSED, false);
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
}

export function isFinished(): boolean {
  return cache.finished;
}

export function finish(): void {
  if (cache.finished) return;
  cache.finished = true;
  flushFlag(SETTING_FINISHED, true);
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
}

export function isWizardDone(): boolean {
  return cache.wizardDone;
}

export function finishWizard(): void {
  if (cache.wizardDone) return;
  cache.wizardDone = true;
  void setSetting(tauriDatabase, SETTING_WIZARD, 'done');
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
}

export function reopenWizard(): void {
  window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT));
}
