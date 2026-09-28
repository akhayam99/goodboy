import { Plus } from 'lucide-react';
import { Button, KbdPill } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { requestNewSession } from '../../../session/requestNewSession';

export const NewSessionButton = () => (
  <Button
    variant="secondary"
    size="sm"
    onClick={requestNewSession}
    aria-label="Create new session"
    className="group relative min-w-0 flex-1 justify-center gap-1.5 px-2 text-label"
  >
    <Plus size={ICON_SIZE.row} aria-hidden />
    New
    <KbdPill
      aria-hidden
      className="pointer-events-none absolute right-2 top-1/2 h-4 min-w-4 -translate-y-1/2 px-1 text-meta opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {shortcutGlyphs('session.new')}
    </KbdPill>
  </Button>
);
