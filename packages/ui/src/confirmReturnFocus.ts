const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Params = {
  readonly anchor: HTMLElement | null;
  readonly rowSelector: string;
};

type MatchParams = {
  readonly candidate: Element | null;
  readonly rowSelector: string;
};

const matchingRow = ({ candidate, rowSelector }: MatchParams): HTMLElement | null =>
  candidate instanceof HTMLElement && candidate.matches(rowSelector) ? candidate : null;

const focusInside = (target: HTMLElement): void => {
  const inner = target.querySelector(FOCUSABLE);
  if (inner instanceof HTMLElement) {
    inner.focus();
    return;
  }
  if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
  }
  target.focus();
};

export const captureReturnFocus = ({ anchor, rowSelector }: Params): (() => void) => {
  const row = anchor?.closest(rowSelector) ?? null;
  if (anchor === null || row === null) {
    return () => undefined;
  }
  const next = matchingRow({ candidate: row.nextElementSibling, rowSelector });
  const previous = matchingRow({ candidate: row.previousElementSibling, rowSelector });
  const list = row.parentElement;
  return () => {
    if (anchor.isConnected) {
      return;
    }
    const survivor = [next, previous, list].find(
      (candidate) => candidate !== null && candidate.isConnected,
    );
    if (survivor === undefined || survivor === null) {
      return;
    }
    if (survivor === list) {
      if (!survivor.hasAttribute('tabindex')) {
        survivor.setAttribute('tabindex', '-1');
      }
      survivor.focus();
      return;
    }
    focusInside(survivor);
  };
};
