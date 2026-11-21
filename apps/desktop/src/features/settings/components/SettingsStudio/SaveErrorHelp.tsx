import type { ReactNode } from 'react';
import { Button, FieldError } from '@goodboy/ui';
import type { SettingSave } from '../../hooks/useSettingSave';

type Props = {
  readonly id: string;
  readonly help?: ReactNode;
  readonly save: Pick<SettingSave<unknown>, 'error' | 'isSaving' | 'retry'>;
};

export const SaveErrorHelp = ({ id, help, save }: Props) => (
  <span className="flex flex-col gap-0.5">
    {help}
    <span className="flex flex-wrap items-center gap-2">
      <FieldError id={id} error={save.error} />
      <Button
        variant="secondary"
        size="xs"
        isBusy={save.isSaving}
        disabled={save.isSaving}
        onClick={() => void save.retry()}
      >
        Retry
      </Button>
    </span>
  </span>
);
