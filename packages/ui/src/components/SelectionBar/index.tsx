import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';
import { tintClasses } from '../../tint';
import { useEscapeLayer } from '../../useEscapeLayer';
import { Button } from '../Button';
import { KbdPill } from '../KbdPill';
import { IconButton } from '../IconButton';

export type SelectionVerb = {
  readonly id: string;
  readonly label: string;
  readonly ariaLabel?: string;
  readonly title?: string;
  readonly icon?: ReactNode;
  readonly tone?: 'neutral' | 'danger' | 'primary';
  readonly hint?: string;
  readonly isBusy?: boolean;
  readonly isDisabled?: boolean;
  readonly onRun: () => void;
};

export type SelectionBarPlacement = 'overlay' | 'sticky' | 'flow';

export type SelectionBarProps = {
  readonly count: number;
  readonly total: number;
  readonly verbs: ReadonlyArray<SelectionVerb>;
  readonly onClear: () => void;
  readonly onSelectAll: () => void;
  readonly confirm?: ReactNode;
  readonly onDismissConfirm?: () => void;
  readonly note?: ReactNode;
  readonly clearHint?: string;
  readonly selectAllHint?: string;
  readonly onFocusReturn?: () => void;
  readonly placement?: SelectionBarPlacement;
  readonly ariaLabel?: string;
  readonly className?: string;
};

const PLACEMENT_CLASSES: Record<SelectionBarPlacement, string> = {
  overlay:
    'pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-3 *:pointer-events-auto',
  sticky:
    'pointer-events-none sticky bottom-4 z-20 flex flex-col items-center gap-2 px-3 *:pointer-events-auto',
  flow: 'flex flex-col items-center gap-2',
};

const withHint = ({ text, hint }: { readonly text: string; readonly hint?: string }): string =>
  hint === undefined ? text : `${text} (${hint})`;

export const SelectionBar = ({
  count,
  total,
  verbs,
  onClear,
  onSelectAll,
  confirm = null,
  onDismissConfirm,
  note = null,
  clearHint,
  selectAllHint,
  onFocusReturn,
  placement = 'overlay',
  ariaLabel,
  className,
}: SelectionBarProps) => {
  const dockRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<Element | null>(null);
  const wasConfirmingRef = useRef(false);
  const wasShownRef = useRef(false);
  const returnRef = useRef(onFocusReturn);
  returnRef.current = onFocusReturn;
  const isConfirming = confirm !== null;
  const hasBar = count > 0;
  const isShown = hasBar || isConfirming || note !== null;

  useEscapeLayer(() => {
    if (isConfirming) {
      onDismissConfirm?.();
      return;
    }
    onClear();
  }, hasBar || isConfirming);

  useEffect(() => {
    const dock = dockRef.current;
    const wasConfirming = wasConfirmingRef.current;
    wasConfirmingRef.current = isConfirming;
    if (isConfirming && !wasConfirming) {
      const active = document.activeElement;
      triggerRef.current =
        dock !== null && active !== null && dock.contains(active) ? active : null;
      dock?.querySelector<HTMLElement>('[data-confirm-cancel]')?.focus();
      return;
    }
    if (isConfirming || !wasConfirming) {
      return;
    }
    const trigger = triggerRef.current;
    triggerRef.current = null;
    const active = document.activeElement;
    const isLost = active === null || active === document.body || !document.contains(active);
    if (!isLost) {
      return;
    }
    if (trigger instanceof HTMLElement && trigger.isConnected) {
      trigger.focus();
      return;
    }
    returnRef.current?.();
  }, [isConfirming]);

  useEffect(() => {
    if (wasShownRef.current && !isShown) {
      const active = document.activeElement;
      if (active === null || active === document.body || !document.contains(active)) {
        returnRef.current?.();
      }
    }
    wasShownRef.current = isShown;
  }, [isShown]);

  if (!isShown) {
    return null;
  }

  return (
    <div
      ref={dockRef}
      data-selection-dock
      data-placement={placement}
      aria-live="polite"
      className={cn(PLACEMENT_CLASSES[placement], className)}
    >
      {confirm}
      {note}
      {hasBar ? (
        <div
          role="toolbar"
          aria-label={ariaLabel ?? `${count} selected`}
          className="flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-border bg-floating py-1 pl-1 pr-1.5 shadow-lg motion-safe:animate-studio-in"
        >
          <span className="flex items-center gap-1.5">
            <IconButton
              icon={X}
              iconSize={13}
              variant="ghost"
              label="Clear selection"
              tooltip={withHint({ text: 'Clear selection', hint: clearHint })}
              onClick={onClear}
              className="p-1"
            />
            <span className="whitespace-nowrap text-row tabular-nums text-foreground">
              {count} selected
            </span>
            {count < total ? (
              <button
                type="button"
                title={withHint({ text: 'Select all', hint: selectAllHint })}
                onClick={onSelectAll}
                className={cn(
                  'whitespace-nowrap rounded-md px-2 py-1 text-label text-muted-foreground hover:bg-hover hover:text-foreground motion-safe:transition-colors',
                  FOCUS_RING,
                )}
              >
                Select all {total}
              </button>
            ) : null}
          </span>
          {verbs.length === 0 ? null : (
            <span className="ml-2 flex flex-wrap items-center gap-1">
              {verbs.map((verb) => (
                <Button
                  key={verb.id}
                  variant={verb.tone === 'primary' ? 'primary' : 'ghost'}
                  size="sm"
                  aria-label={verb.ariaLabel ?? verb.label}
                  title={verb.title}
                  isBusy={verb.isBusy}
                  disabled={verb.isDisabled}
                  onClick={verb.onRun}
                  className={cn(
                    'gap-1.5 whitespace-nowrap',
                    verb.tone === 'danger' &&
                      cn(tintClasses('danger').text, tintClasses('danger').hoverBg),
                  )}
                >
                  {verb.icon}
                  {verb.label}
                  {verb.hint === undefined ? null : (
                    <KbdPill
                      aria-hidden
                      className="h-4 min-w-4 border-on-tone/30 bg-on-tone/15 text-chip text-on-tone"
                    >
                      {verb.hint}
                    </KbdPill>
                  )}
                </Button>
              ))}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
};
