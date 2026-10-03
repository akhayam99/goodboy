import { KbdPill } from '@goodboy/ui';
import {
  SHORTCUTS,
  shortcutGlyphs,
  type ShortcutId,
} from '../../../../../shared/keyboard/registry';
import { Block } from './Block';

const GUIDE_SHORTCUTS: ReadonlyArray<ShortcutId> = [
  'palette.open',
  'session.new',
  'session.board',
  'workspace.switcher',
  'nav.back',
  'nav.forward',
  'settings.open',
  'settings.shortcuts',
];

type Props = Record<never, never>;

export const ShortcutsExtra = ({}: Props) => (
  <Block title="Keys worth learning first">
    <ul className="grid grid-cols-2 gap-x-8 gap-y-2">
      {GUIDE_SHORTCUTS.map((id) => (
        <li key={id} className="flex items-center justify-between gap-3">
          <span className="text-body text-muted-foreground">{SHORTCUTS[id].label}</span>
          <KbdPill>{shortcutGlyphs(id)}</KbdPill>
        </li>
      ))}
    </ul>
  </Block>
);
