import { useEffect } from 'react';

const POLL_MS = 150;

const SELECTED_GOALS = [
  'Nightly reconciliation before the Monday close',
  'Fix the rounding drift in the settlement export',
  'Reconcile the settlement export against the ledger snapshot',
] as const;

type Params = {
  readonly isConfirming: boolean;
};

const clickIfFound = ({ selector }: { readonly selector: () => HTMLElement | null }): boolean => {
  const node = selector();
  if (node === null) {
    return false;
  }
  node.click();
  return true;
};

export const useSelectBoardCards = ({ isConfirming }: Params): void => {
  useEffect(() => {
    let step = 0;
    const interval = window.setInterval(() => {
      const goal = SELECTED_GOALS[step];
      if (goal !== undefined) {
        const isClicked = clickIfFound({
          selector: () =>
            document.querySelector<HTMLElement>(`[role="checkbox"][aria-label="Select ${goal}"]`),
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
          document.querySelector<HTMLElement>('[role="toolbar"] [aria-label="Delete 3 sessions"]'),
      });
      if (isOpened) {
        window.clearInterval(interval);
      }
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [isConfirming]);
};
