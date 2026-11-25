import type { ConsoleLevelFilter } from '../../consoleRowsOf';

type ChangeParams = {
  readonly next: ConsoleLevelFilter;
};

type Params = {
  readonly onChange: (params: ChangeParams) => void;
};

export const levelSelectOf =
  ({ onChange }: Params) =>
  (choice: string): void => {
    if (choice === 'all' || choice === 'error' || choice === 'warn' || choice === 'info') {
      onChange({ next: choice });
    }
  };
