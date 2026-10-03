import { Copy, RotateCcw } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { FlowMode } from './WorkspaceSettingsFlow';

type Props = {
  readonly mode: FlowMode | null;
  readonly onOpen: (mode: FlowMode) => void;
};

export const SettingsHomeWorkspaceTools = ({ mode, onOpen }: Props) => (
  <span className="flex items-center gap-1">
    <Button
      variant="secondary"
      size="sm"
      aria-expanded={mode === 'copy'}
      onClick={() => onOpen('copy')}
    >
      <Copy size={ICON_SIZE.row} aria-hidden />
      Copy settings from…
    </Button>
    <Button
      variant="ghost"
      size="sm"
      aria-expanded={mode === 'restore'}
      onClick={() => onOpen('restore')}
    >
      <RotateCcw size={ICON_SIZE.row} aria-hidden />
      Restore defaults
    </Button>
  </span>
);
