import { getSetting, setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';
import {
  isNumberedStepId,
  resumeStep,
  type NumberedWizardStepId,
  type WizardMode,
  type WizardStepId,
} from './OnboardingWizard/wizardSteps';
import type { SetupItemId } from './setupProgress';

export type OnboardingStepId = SetupItemId | 'profile';

export type WizardState = 'open' | 'later' | 'done';

export const PROFILE_SUGGESTION = {
  id: 'profile',
  title: 'Tell agents about you',
  why: 'Your role and how much to explain. Optional.',
} as const satisfies {
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly why: string;
};

const SETTING_PROGRESS = 'onboarding.progress';
const SETTING_COLLAPSED = 'onboarding.collapsed';
const SETTING_FINISHED = 'onboarding.finished';
const SETTING_WIZARD = 'onboarding.wizard';
const SETTING_STEP = 'onboarding.step';

export const ONBOARDING_PROGRESS_EVENT = 'goodboy:onboarding-progress';
export const OPEN_WIZARD_EVENT = 'goodboy:open-onboarding-wizard';

export type OpenWizardDetail = {
  readonly mode: WizardMode;
  readonly step?: WizardStepId;
};

const STEP_IDS: ReadonlyArray<OnboardingStepId> = [
  'agents',
  'workspace',
  'tools',
  'first-session',
  'profile',
];

const LEGACY_STEP_IDS: Readonly<Record<string, OnboardingStepId>> = {
  provider: 'agents',
  project: 'workspace',
  codeHost: 'tools',
  taskManager: 'tools',
  firstSession: 'first-session',
};

const WIZARD_VALUE: Readonly<Record<WizardState, string>> = {
  open: '',
  later: 'later',
  done: 'done',
};

type OnboardingCache = {
  completed: ReadonlyArray<OnboardingStepId>;
  collapsed: boolean;
  finished: boolean;
  wizard: WizardState;
  step: NumberedWizardStepId | null;
};

const cache: OnboardingCache = {
  completed: [],
  collapsed: false,
  finished: false,
  wizard: 'open',
  step: null,
};

let writes: Promise<void> = Promise.resolve();

type WriteParams = {
  readonly key: string;
  readonly value: string;
};

const persist = ({ key, value }: WriteParams): Promise<void> => {
  const write = () => setSetting(tauriDatabase, key, value);
  writes = writes.then(write, write);
  return writes;
};

const announce = (): void => {
  window.dispatchEvent(new CustomEvent(ONBOARDING_PROGRESS_EVENT));
};

const isStepId = (value: string): value is OnboardingStepId => STEP_IDS.some((id) => id === value);

const parseWizard = (raw: string | null): WizardState => {
  if (raw === 'done' || raw === 'later') {
    return raw;
  }
  return 'open';
};

const parseStep = (raw: string | null): NumberedWizardStepId | null => {
  if (raw === null || !isNumberedStepId(raw)) {
    return null;
  }
  return raw;
};

const completedFrom = (parsed: unknown): ReadonlyArray<unknown> => {
  if (typeof parsed !== 'object' || parsed === null || !('completed' in parsed)) {
    return [];
  }
  return Array.isArray(parsed.completed) ? parsed.completed : [];
};

const parseCompleted = (raw: string | null): ReadonlyArray<OnboardingStepId> => {
  if (raw === null || raw.length === 0) {
    return [];
  }
  try {
    const ids = completedFrom(JSON.parse(raw)).flatMap((entry): ReadonlyArray<OnboardingStepId> => {
      if (typeof entry !== 'string') {
        return [];
      }
      const id = LEGACY_STEP_IDS[entry] ?? entry;
      return isStepId(id) ? [id] : [];
    });
    return [...new Set(ids)];
  } catch {
    return [];
  }
};

export const hydrateOnboardingFromDb = async (): Promise<void> => {
  const [rawProgress, rawCollapsed, rawFinished, rawWizard, rawStep] = await Promise.all([
    getSetting(tauriDatabase, SETTING_PROGRESS),
    getSetting(tauriDatabase, SETTING_COLLAPSED),
    getSetting(tauriDatabase, SETTING_FINISHED),
    getSetting(tauriDatabase, SETTING_WIZARD),
    getSetting(tauriDatabase, SETTING_STEP),
  ]);
  cache.completed = parseCompleted(rawProgress);
  cache.collapsed = rawCollapsed === '1';
  cache.finished = rawFinished === '1';
  cache.wizard = parseWizard(rawWizard);
  cache.step = parseStep(rawStep);
  announce();
};

type FlagParams = {
  readonly key: string;
  readonly isOn: boolean;
};

const flushFlag = ({ key, isOn }: FlagParams): void => {
  void persist({ key, value: isOn ? '1' : '0' });
};

export const getCompleted = (): ReadonlyArray<OnboardingStepId> => cache.completed;

export const markStepComplete = (id: OnboardingStepId): void => {
  if (cache.completed.includes(id)) {
    return;
  }
  cache.completed = [...cache.completed, id];
  void persist({ key: SETTING_PROGRESS, value: JSON.stringify({ completed: cache.completed }) });
  announce();
};

export const isCollapsed = (): boolean => cache.collapsed;

export const collapse = (): void => {
  if (cache.collapsed) {
    return;
  }
  cache.collapsed = true;
  flushFlag({ key: SETTING_COLLAPSED, isOn: true });
  announce();
};

export const isFinished = (): boolean => cache.finished;

export const finish = (): void => {
  if (cache.finished) {
    return;
  }
  cache.finished = true;
  flushFlag({ key: SETTING_FINISHED, isOn: true });
  announce();
};

export const getWizardState = (): WizardState => cache.wizard;

export const isWizardDone = (): boolean => cache.wizard === 'done';

export const getWizardStep = (): NumberedWizardStepId | null => cache.step;

type WizardWriteParams = {
  readonly next: WizardState;
};

const writeWizard = async ({ next }: WizardWriteParams): Promise<void> => {
  if (cache.wizard === next) {
    announce();
    return;
  }
  await persist({ key: SETTING_WIZARD, value: WIZARD_VALUE[next] });
  cache.wizard = next;
  announce();
};

type EnterParams = {
  readonly step: NumberedWizardStepId;
};

export const enterWizardStep = async ({ step }: EnterParams): Promise<void> => {
  await persist({ key: SETTING_STEP, value: step });
  cache.step = step;
};

export const pauseWizard = (): Promise<void> => writeWizard({ next: 'later' });

export const finishWizard = (): Promise<void> => writeWizard({ next: 'done' });

export const reopenWizard = (mode: WizardMode = 'full', step?: WizardStepId): void => {
  if (cache.wizard !== 'open') {
    void writeWizard({ next: 'open' });
  }
  const detail: OpenWizardDetail = step === undefined ? { mode } : { mode, step };
  window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT, { detail }));
};

type ResumeSetupParams = {
  readonly step?: NumberedWizardStepId;
  readonly hasWorkspace: boolean;
};

export const resumeSetup = ({ step, hasWorkspace }: ResumeSetupParams): void => {
  reopenWizard('setup', step ?? resumeStep({ saved: cache.step, hasWorkspace }));
};

export const openWizardStep = (step: WizardStepId): void => {
  window.dispatchEvent(
    new CustomEvent<OpenWizardDetail>(OPEN_WIZARD_EVENT, { detail: { mode: 'single', step } }),
  );
};
