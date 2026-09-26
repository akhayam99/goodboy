import { fireEvent } from '@testing-library/react';

type Params = {
  readonly trigger: HTMLElement;
  readonly value: string;
};

export const listboxValueOf = ({ trigger }: { trigger: HTMLElement }): string =>
  trigger.getAttribute('data-value') ?? '';

export const chooseListboxValue = ({ trigger, value }: Params): void => {
  if (trigger.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(trigger);
  }
  const option = document.querySelector<HTMLElement>(
    `[role="option"][data-value="${CSS.escape(value)}"]`,
  );
  if (option === null) {
    throw new Error(`no listbox option with value ${value}`);
  }
  fireEvent.click(option);
};
