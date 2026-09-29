type Step = {
  readonly find: () => HTMLElement | null;
  readonly isDone: (element: HTMLElement) => boolean;
};

export type ChatWorkStage = 'drawer' | 'project' | 'add' | 'session';

const isExpanded = (element: HTMLElement): boolean =>
  element.getAttribute('aria-expanded') === 'true';

const isSelected = (element: HTMLElement): boolean =>
  element.getAttribute('aria-selected') === 'true';

const buttonWithText = (text: string): Step => ({
  find: () =>
    Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === text,
    ) ?? null,
  isDone: isExpanded,
});

const tabWithText = (text: string): Step => ({
  find: () =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).find(
      (tab) => tab.textContent?.trim() === text,
    ) ?? null,
  isDone: isSelected,
});

const comboboxLabelled = (label: string): Step => ({
  find: () => document.querySelector<HTMLElement>(`[role="combobox"][aria-label="${label}"]`),
  isDone: isExpanded,
});

const STEPS: Readonly<Record<ChatWorkStage, ReadonlyArray<Step>>> = {
  drawer: [buttonWithText('Start work')],
  project: [buttonWithText('Start work'), comboboxLabelled('Project')],
  add: [buttonWithText('Start work'), tabWithText('Add to a session')],
  session: [
    buttonWithText('Start work'),
    tabWithText('Add to a session'),
    comboboxLabelled('Session'),
  ],
};

export const isChatWorkStage = (value: string | null): value is ChatWorkStage =>
  value !== null && value in STEPS;

type DriveParams = {
  readonly stage: ChatWorkStage;
};

const isReachable = (element: HTMLElement): boolean =>
  !(element instanceof HTMLButtonElement && element.disabled) &&
  element.getAttribute('aria-disabled') !== 'true';

export const driveChatWork = ({ stage }: DriveParams): (() => void) => {
  const steps = STEPS[stage];
  const clicked = new WeakSet<HTMLElement>();
  const advance = (): void => {
    for (const step of steps) {
      const element = step.find();
      if (element === null || !isReachable(element)) {
        return;
      }
      if (step.isDone(element) || clicked.has(element)) {
        continue;
      }
      clicked.add(element);
      element.click();
    }
    observer.disconnect();
  };
  const observer = new MutationObserver(advance);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  advance();
  return () => observer.disconnect();
};
