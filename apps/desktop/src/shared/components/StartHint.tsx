import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton, useEscapeLayer } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { START_HINT_LIMITS } from '../../store/slices/startHints/startHintLimits';
import { startHintCounterOf } from '../../store/slices/startHints/startHintCounterOf';
import { startHintTextOf } from '../../store/slices/startHints/startHintTextOf';
import { CONCEPT_ICONS, ICON_SIZE } from './conceptIcons';
import { PromptField } from './PromptField';

type Props = {
  readonly sessionId: SessionId;
  readonly scope: string;
  readonly label: string;
  readonly placeholder: string;
  readonly isDisabled?: boolean;
  readonly disabledNote?: string;
};

export const StartHint = ({
  sessionId,
  scope,
  label,
  placeholder,
  isDisabled = false,
  disabledNote,
}: Props) => {
  const text = useAppStore((state) => startHintTextOf({ state, sessionId, scope }));
  const setStartHint = useAppStore((state) => state.setStartHint);
  const [isOpen, setIsOpen] = useState(text !== '');
  const [shouldFocus, setShouldFocus] = useState(false);
  const [isArmed, setIsArmed] = useState(false);
  useEffect(() => {
    setIsArmed(isOpen);
  }, [isOpen]);
  useEscapeLayer(() => setIsOpen(false), isOpen && isArmed);
  const HintIcon = CONCEPT_ICONS.message;
  const counter = startHintCounterOf({ length: text.length });
  if (!isOpen) {
    return (
      <div className="flex min-w-0 items-center">
        <Button
          size="sm"
          variant="ghost"
          disabled={isDisabled}
          onClick={() => {
            setShouldFocus(true);
            setIsOpen(true);
          }}
        >
          <HintIcon size={ICON_SIZE.row} aria-hidden />
          {text === '' ? 'Add a hint' : 'Edit hint'}
        </Button>
      </div>
    );
  }
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center justify-between gap-2 px-2">
        <span className="text-meta text-faint-foreground">{label}</span>
        <div className="flex shrink-0 items-center gap-1">
          {counter === null ? null : (
            <span role="status" className="text-meta tabular-nums text-faint-foreground">
              {counter}
            </span>
          )}
          {text === '' ? null : (
            <IconButton
              icon={X}
              label="Clear hint"
              variant="ghost"
              iconSize={12}
              disabled={isDisabled}
              onClick={() => setStartHint({ sessionId, scope, text: '' })}
            />
          )}
        </div>
      </div>
      <PromptField
        kind="document"
        variant="bare"
        label={label}
        placeholder={placeholder}
        value={text}
        onChange={(value) => setStartHint({ sessionId, scope, text: value })}
        disabled={isDisabled}
        autoFocus={shouldFocus}
        minRows={2}
        maxRows={6}
        maxLength={START_HINT_LIMITS.max}
        className="relative after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border-soft focus-within:after:bg-border-strong"
      />
      {isDisabled && disabledNote !== undefined ? (
        <p className="px-2 text-meta text-faint-foreground">{disabledNote}</p>
      ) : null}
    </div>
  );
};
