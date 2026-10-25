import { Pin } from 'lucide-react';
import { Button, ICON_SIZE, Tooltip } from '@goodboy/ui';

import type { RunnableScript } from '../../buildSessionScripts';

type Props = {
  readonly script: RunnableScript;
  readonly onPin: () => void;
};

export const SuggestedRow = ({ script, onPin }: Props) => (
  <div
    data-script-key={script.key}
    className="flex h-8 items-center gap-2 rounded-md px-2 opacity-70 transition-opacity focus-within:opacity-100 hover:opacity-100"
  >
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      <Tooltip content={`Runs ${script.invocation}`}>
        <span className="shrink-0 truncate text-row text-foreground">{script.name}</span>
      </Tooltip>
      <span className="min-w-0 truncate text-code text-faint-foreground">{script.body}</span>
    </span>
    <Button variant="ghost" size="xs" aria-label={`Pin ${script.name}`} onClick={onPin}>
      <Pin size={ICON_SIZE.row} aria-hidden />
      Pin
    </Button>
  </div>
);
