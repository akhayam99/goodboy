import { Button, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../conceptIcons';
import type { TerminalSelectionAction } from './index';

type Props = {
  readonly action: TerminalSelectionAction;
  readonly selectedText: () => string;
};

export const TerminalSelectionButton = ({ action, selectedText }: Props) => (
  <Button
    variant="secondary"
    size="sm"
    className="absolute bottom-2 right-3 z-10"
    onMouseDown={(event) => event.preventDefault()}
    onClick={() => {
      const text = selectedText();
      if (text.trim() !== '') {
        action.onAct({ text });
      }
    }}
  >
    <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden />
    {action.label}
  </Button>
);
