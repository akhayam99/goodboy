import { cn, tintClasses } from '@goodboy/ui';
import type { DiffThreadAction } from './types';
import { THREAD_ACTION_CLASS, THREAD_PRIMARY_ACTION_CLASS } from './threadActionClass';

type Props = {
  readonly action: DiffThreadAction;
};

export const ThreadActionButton = ({ action }: Props) => (
  <button
    type="button"
    className={
      action.isPrimary
        ? cn(tintClasses('primary').solid, THREAD_PRIMARY_ACTION_CLASS)
        : THREAD_ACTION_CLASS
    }
    onClick={action.onClick}
  >
    {action.label}
  </button>
);
