import type { ReactNode } from 'react';
import { Button } from '@goodboy/ui';
import type { SettingSave } from '../../hooks/useSettingSave';

type Props = {
  readonly help?: ReactNode;
  readonly save: Pick<SettingSave<unknown>, 'error' | 'retry'>;
};

export const SaveErrorHelp = ({ help, save }: Props) => (
  <span className="flex flex-col gap-0.5">
    {help}
    <span role="alert" className="flex flex-wrap items-center gap-2 text-danger">
      {save.error}
      <Button variant="secondary" size="xs" onClick={() => void save.retry()}>
        Retry
      </Button>
    </span>
  </span>
);
