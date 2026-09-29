type Step = () => HTMLElement | null;

export type ChatWorkStage = 'drawer' | 'project' | 'add' | 'session';

const buttonWithText =
  (text: string): Step =>
  () =>
    Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === text,
    ) ?? null;

const tabWithText =
  (text: string): Step =>
  () =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).find(
      (tab) => tab.textContent?.trim() === text,
    ) ?? null;

const comboboxLabelled =
  (label: string): Step =>
  () =>
    document.querySelector<HTMLElement>(`[role="combobox"][aria-label="${label}"]`);

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

export const driveChatWork = ({ stage }: DriveParams): (() => void) => {
  const pending = [...STEPS[stage]];
  const advance = (): void => {
    let next = pending[0]?.();
    while (next !== undefined && next !== null) {
      next.click();
      pending.shift();
      next = pending[0]?.();
    }
    if (pending.length === 0) {
      observer.disconnect();
    }
  };
  const observer = new MutationObserver(advance);
  observer.observe(document.body, { childList: true, subtree: true });
  advance();
  return () => observer.disconnect();
};
