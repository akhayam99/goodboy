import { ArrowUp, Square } from 'lucide-react';
import { Button, cn, Tooltip, tintClasses, KeyHint } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { formatCombo, shortcutGlyphs } from '../../../../../shared/keyboard/registry';

type Props = {
  readonly isRunning: boolean;
  readonly isEmpty: boolean;
  readonly canSend: boolean;
  readonly showsDeliveryChoice: boolean;
  readonly sendDisabledTitle?: string;
  readonly onCancel: () => void;
  readonly onSend: () => void;
  readonly onSendNow: () => void;
};

export const SendControl = ({
  isRunning,
  isEmpty,
  canSend,
  showsDeliveryChoice,
  sendDisabledTitle,
  onCancel,
  onSend,
  onSendNow,
}: Props) => {
  if (isRunning && isEmpty) {
    return (
      <Tooltip content="Stop the turn">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className={cn(tintClasses('danger').text, tintClasses('danger').hoverBg)}
        >
          <Square size={ICON_SIZE.row} aria-hidden fill="currentColor" />
          Stop
        </Button>
      </Tooltip>
    );
  }

  if (showsDeliveryChoice) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={onSend}>
          Queue
          <KeyHint keys={formatCombo('Enter')} />
        </Button>
        <Button variant="primary" size="sm" onClick={onSendNow}>
          Send now
          <KeyHint keys={shortcutGlyphs('composer.submit')} onTone />
        </Button>
      </>
    );
  }

  return (
    <Tooltip content={sendDisabledTitle ?? 'Send (enter)'}>
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        aria-label="Send message"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-on-tone shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
      >
        <ArrowUp size={ICON_SIZE.control} aria-hidden />
      </button>
    </Tooltip>
  );
};
