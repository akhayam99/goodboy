import { useEffect } from 'react';

const POLL_MS = 150;

const SELECTED_GOALS = [
  'Nightly reconciliation before the Monday close',
  'Fix the rounding drift in the settlement export',
  'Reconcile the settlement export against the ledger snapshot',
] as const;

type Params = {
  readonly isConfirming: boolean;
  readonly verb?: 'Delete' | 'Archive';
};

const clickIfFound = ({
  selector,
  isOption = false,
}: {
  readonly selector: () => HTMLElement | null;
  readonly isOption?: boolean;
}): boolean => {
  const node = selector();
  if (node === null) {
    return false;
  }
  if (isOption) {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }));
    return true;
  }
  node.click();
  return true;
};

type CardParams = {
  readonly goal: string;
};

const cardTitleOf = ({ goal }: CardParams): HTMLElement | null =>
  Array.from(
    document.querySelectorAll<HTMLElement>('article[data-select-id] button[aria-pressed]'),
  ).find((button) => button.textContent === goal) ?? null;

export const useSelectBoardCards = ({ isConfirming, verb = 'Delete' }: Params): void => {
  useEffect(() => {
    let step = 0;
    const interval = window.setInterval(() => {
      const goal = SELECTED_GOALS[step];
      if (goal !== undefined) {
        const isClicked = clickIfFound({
          selector: () => cardTitleOf({ goal }),
          isOption: true,
        });
        step += isClicked ? 1 : 0;
        return;
      }
      if (!isConfirming) {
        window.clearInterval(interval);
        return;
      }
      const isOpened = clickIfFound({
        selector: () =>
          document.querySelector<HTMLElement>(
            `[role="toolbar"] [aria-label="${verb} ${SELECTED_GOALS.length} sessions"]`,
          ),
      });
      if (isOpened) {
        window.clearInterval(interval);
      }
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [isConfirming, verb]);
};
