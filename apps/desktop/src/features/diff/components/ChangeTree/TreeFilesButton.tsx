import type { Ref } from 'react';
import { ListTree } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

type Props = {
  readonly viewed: number;
  readonly total: number;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly triggerRef: Ref<HTMLButtonElement>;
};

export const TreeFilesButton = ({ viewed, total, isOpen, onToggle, triggerRef }: Props) => (
  <Button
    ref={triggerRef}
    size="sm"
    variant="ghost"
    aria-expanded={isOpen}
    aria-label={`Files, ${viewed} of ${total} viewed`}
    title={`Files (${shortcutGlyphs('diff.focusTree')})`}
    onClick={onToggle}
    className="shrink-0"
  >
    <ListTree size={ICON_SIZE.control} aria-hidden />
    Files
    <span className="text-meta tabular-nums text-faint-foreground">
      {viewed}/{total}
    </span>
  </Button>
);
