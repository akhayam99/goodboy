import { useEffect } from 'react';

export type AutoplayStep = Readonly<{
  selector: string;
  text?: string;
}>;

type Params = Readonly<{
  isReady: boolean;
  steps: ReadonlyArray<AutoplayStep>;
}>;

const POLL_MS = 120;

const typeInto = ({
  field,
  text,
}: {
  readonly field: HTMLElement;
  readonly text: string;
}): void => {
  if (!(field instanceof HTMLTextAreaElement)) {
    return;
  }
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setValue?.call(field, text);
  field.dispatchEvent(new Event('input', { bubbles: true }));
};

export const usePlanDrawerAutoplay = ({ isReady, steps }: Params): void => {
  useEffect(() => {
    if (!isReady || steps.length === 0) {
      return;
    }
    let index = 0;
    const interval = window.setInterval(() => {
      const step = steps[index];
      if (step === undefined) {
        window.clearInterval(interval);
        return;
      }
      const target = window.document.querySelector<HTMLElement>(step.selector);
      if (target === null) {
        return;
      }
      index += 1;
      if (step.text !== undefined) {
        typeInto({ field: target, text: step.text });
        return;
      }
      target.click();
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [isReady, steps]);
};
