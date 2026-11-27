import { Button, ICON_SIZE } from '@goodboy/ui';
import { Plus } from '@goodboy/ui/icons';
import { requestNewSession } from '../session/requestNewSession';

export const StartFirstSession = () => (
  <section
    aria-label="Start your first session"
    className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border-soft bg-elevated p-3"
  >
    <span className="min-w-0 truncate text-row text-foreground">Start your first session</span>
    <Button size="sm" onClick={requestNewSession}>
      <Plus size={ICON_SIZE.row} aria-hidden />
      Start session
    </Button>
  </section>
);
