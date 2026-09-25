import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton, Notice, cn, type NoticeTone } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { toastDuration } from './toastTiming';
import type { ToastItem, ToastKind } from './types';

type ToastCardProps = {
  readonly toast: ToastItem;
  readonly onDismiss: (params: { id: string }) => void;
};

const KIND_TONE = {
  error: 'danger',
  warning: 'warning',
  success: 'success',
  info: 'info',
} as const satisfies Record<ToastKind, NoticeTone>;

const isAssertive = ({ kind }: { kind: ToastKind }): boolean =>
  kind === 'error' || kind === 'warning';

export const ToastCard = ({ toast, onDismiss }: ToastCardProps) => {
  const [isShown, setIsShown] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const duration = toastDuration({ persist: toast.persist, hasAction: toast.action != null });
  const remainingRef = useRef<number | null>(duration);
  const isPaused = isHovered || isFocused;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    remainingRef.current = duration;
  }, [duration, toast.revision]);

  useEffect(() => {
    if (duration === null || isPaused) {
      return;
    }
    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss({ id: toast.id }), remainingRef.current ?? duration);
    return () => {
      clearTimeout(timer);
      const left = (remainingRef.current ?? duration) - (Date.now() - startedAt);
      remainingRef.current = Math.max(0, left);
    };
  }, [duration, isPaused, toast.id, toast.revision, onDismiss]);

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setIsFocused(false);
  };

  const hasTitle = toast.title !== undefined && toast.title !== '';
  const hasContext = toast.context !== undefined && toast.context !== '';
  const { action } = toast;
  const headline = hasTitle ? toast.title : toast.message;
  const hasMessageInBody = hasTitle && toast.message !== '';

  return (
    <div
      role={isAssertive({ kind: toast.kind }) ? 'alert' : 'status'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={onBlur}
      className={cn(
        'pointer-events-auto w-full',
        'motion-safe:transition-all motion-safe:duration-200',
        isShown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      <Notice
        tone={KIND_TONE[toast.kind]}
        placement="floating"
        title={
          <>
            {headline}
            {toast.count > 1 && (
              <span className="ml-2 text-2xs font-medium tabular-nums text-muted-foreground">
                ×{toast.count}
              </span>
            )}
          </>
        }
        body={
          (hasMessageInBody || hasContext) && (
            <>
              {hasMessageInBody && <p>{toast.message}</p>}
              {hasContext && (
                <p className="mt-0.5 line-clamp-2 text-2xs text-faint-foreground">
                  {toast.context}
                </p>
              )}
            </>
          )
        }
        actions={
          <>
            {action !== undefined && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  action.onClick();
                  onDismiss({ id: toast.id });
                }}
              >
                {action.label}
              </Button>
            )}
            <IconButton
              icon={X}
              label="Dismiss notification"
              variant="ghost"
              iconSize={ICON_SIZE.row}
              className="-my-1 shrink-0 p-1"
              onClick={() => onDismiss({ id: toast.id })}
            />
          </>
        }
      />
    </div>
  );
};
