import { CircleAlert } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import { PUSH_FAILED_TITLE, pushFailedBodyOf } from '../../commentStateCopy';
import type { ResolveRowState } from '../../resolveRowState';

type Props = {
  readonly rowState: ResolveRowState;
};

export const PushFailedNote = ({ rowState }: Props) => (
  <p
    role="alert"
    className="flex min-w-0 items-start gap-2 rounded-lg bg-subtle px-4 py-2 text-meta text-muted-foreground"
  >
    <CircleAlert size={ICON_SIZE.control} aria-hidden className="mt-0.5 shrink-0 text-danger" />
    <span className="min-w-0">
      <span className="block text-meta text-foreground">{PUSH_FAILED_TITLE}</span>
      {pushFailedBodyOf({ rowState })}
    </span>
  </p>
);
