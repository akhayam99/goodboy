import { NAMES } from '../../../../shared/utils/names';

export const FACE_SWITCH_LABEL = `${NAMES.overview} or ${NAMES.desk}`;

type Params = {
  readonly target: 'tab' | 'line';
};

const elementOf = ({ target }: Params): HTMLElement | null => {
  if (target === 'line') {
    return document.querySelector<HTMLElement>('[data-desk-line-action]');
  }
  const tabs = document.querySelectorAll<HTMLElement>(
    `[aria-label="${FACE_SWITCH_LABEL}"] [role="tab"]`,
  );
  return Array.from(tabs).find((tab) => tab.textContent === NAMES.desk) ?? null;
};

export const focusDeskControl = ({ target }: Params): void => {
  requestAnimationFrame(() => {
    elementOf({ target })?.focus();
  });
};
