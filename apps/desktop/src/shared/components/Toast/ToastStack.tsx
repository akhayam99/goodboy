import { ToastCard } from './ToastCard';
import { ToastOverflowChip } from './ToastOverflowChip';
import { TOAST_GUTTER_PX } from './toastRightOf';
import type { ToastItem } from './types';

const MAX_PERSISTED_TOASTS = 3;

type ToastStackProps = {
  readonly toasts: ReadonlyArray<ToastItem>;
  readonly bottom: number | null;
  readonly right: number;
  readonly onDismiss: (params: { id: string }) => void;
  readonly onOpenOverflow: (params: { suppressedIds: ReadonlyArray<string> }) => void;
};

export const ToastStack = ({
  toasts,
  bottom,
  right,
  onDismiss,
  onOpenOverflow,
}: ToastStackProps) => {
  if (toasts.length === 0) {
    return null;
  }
  const persisted = toasts.filter((toast) => toast.persist);
  const overflowCount = Math.max(0, persisted.length - MAX_PERSISTED_TOASTS);
  const suppressedIds = persisted.slice(0, overflowCount).map((toast) => toast.id);
  const suppressed = new Set(suppressedIds);
  const visible = toasts.filter((toast) => !suppressed.has(toast.id));

  return (
    <div
      style={{
        ...(bottom === null ? {} : { bottom }),
        ...(right === TOAST_GUTTER_PX
          ? {}
          : { right, maxWidth: `calc(100vw - ${right + TOAST_GUTTER_PX}px)` }),
      }}
      className="pointer-events-none fixed bottom-12 right-3 z-toast flex w-[22.5rem] max-w-[calc(100vw-1.5rem)] flex-col gap-2"
    >
      {overflowCount > 0 && (
        <ToastOverflowChip count={overflowCount} onOpen={() => onOpenOverflow({ suppressedIds })} />
      )}
      {visible.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
