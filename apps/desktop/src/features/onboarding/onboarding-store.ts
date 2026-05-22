/**
 * Onboarding progress is auto-detected from store state and pinned to
 * localStorage so completion is monotonic — once a step lands as done,
 * it stays done across reloads. Per plan section G.
 */
export type OnboardingStepId = 'workspace' | 'session' | 'agent' | 'plan' | 'skill' | 'palette';

export const ONBOARDING_STEPS: ReadonlyArray<{
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly why: string;
}> = [
  {
    id: 'workspace',
    title: 'Connect a workspace',
    why: 'Point Goodboy at a git repo — every session worktree lives off it.',
  },
  {
    id: 'session',
    title: 'Spin up your first session',
    why: 'A session = one goal on its own worktree + branch. Pick something concrete.',
  },
  {
    id: 'agent',
    title: 'Spawn your first agent',
    why: 'Sessions host agents (planner, scout, implementer…). Spawn the one that fits the work.',
  },
  {
    id: 'plan',
    title: 'Make your first plan',
    why: 'Spawn a planner — it emits a structured plan you can hand off to an implementer.',
  },
  {
    id: 'skill',
    title: 'Try a skill',
    why: 'Skills are reusable prompt blocks. Type / in the chat input to invoke one.',
  },
  {
    id: 'palette',
    title: 'Open the command palette',
    why: '⌘K. Navigate workspaces, sessions, agents, skills — everything from one input.',
  },
];

const STORAGE_KEY = 'goodboy:onboarding-progress';
const DISMISS_KEY = 'goodboy:onboarding-dismissed';

interface PersistedProgress {
  readonly completed: ReadonlyArray<OnboardingStepId>;
}

function readPersisted(): PersistedProgress {
  if (typeof localStorage === 'undefined') return { completed: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { completed: [] };
    const completed = (parsed as { completed?: unknown }).completed;
    if (!Array.isArray(completed)) return { completed: [] };
    return {
      completed: completed.filter(
        (x): x is OnboardingStepId =>
          typeof x === 'string' &&
          ['workspace', 'session', 'agent', 'plan', 'skill', 'palette'].includes(x),
      ),
    };
  } catch {
    return { completed: [] };
  }
}

function writePersisted(progress: PersistedProgress): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // localStorage full / unavailable — ignore
  }
}

export function getCompleted(): ReadonlyArray<OnboardingStepId> {
  return readPersisted().completed;
}

export function markStepComplete(id: OnboardingStepId): void {
  const current = readPersisted();
  if (current.completed.includes(id)) return;
  writePersisted({ completed: [...current.completed, id] });
  window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
}

export function isDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(DISMISS_KEY) === '1';
}

export function dismiss(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DISMISS_KEY, '1');
    window.dispatchEvent(new CustomEvent('goodboy:onboarding-progress'));
  } catch {
    // ignore
  }
}
