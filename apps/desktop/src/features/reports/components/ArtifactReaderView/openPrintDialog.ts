import { formatError } from '@goodboy/ui';

type Params = {
  readonly onFailure: (message: string) => void;
};

const failureMessage = (cause: unknown): string =>
  `this system could not open a print dialog: ${formatError(cause)}`;

export const openPrintDialog = ({ onFailure }: Params): void => {
  try {
    const printed = window.print() as unknown;
    if (printed instanceof Promise) {
      printed.catch((cause: unknown) => onFailure(failureMessage(cause)));
    }
  } catch (cause) {
    onFailure(failureMessage(cause));
  }
};
