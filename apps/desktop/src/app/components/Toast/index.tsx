import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@goodboy/ui';

export type ToastKind = 'info' | 'warning' | 'error' | 'success';

export type ToastItem = {
  readonly id: string;
  readonly kind: ToastKind;
  readonly message: string;
  readonly title?: string;
  readonly context?: string;
  readonly persist?: boolean;
};

export type ShowToastOptions = {
  readonly title?: string;
  readonly context?: string;
  readonly persist?: boolean;
};

type ToastContextValue = {
  showToast: (kind: ToastKind, message: string, opts?: ShowToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

type ToastProviderProps = {
  children: React.ReactNode;
};

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<ReadonlyArray<ToastItem>>([]);

  const showToast = useCallback((kind: ToastKind, message: string, opts?: ShowToastOptions) => {
    const id = crypto.randomUUID();
    const formatted =
      message.length > 0 ? message.charAt(0).toUpperCase() + message.slice(1) : message;
    setToasts((prev) => [
      ...prev,
      {
        id,
        kind,
        message: formatted,
        title: opts?.title,
        context: opts?.context,
        persist: opts?.persist,
      },
    ]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
};

type ToastStackProps = {
  toasts: ReadonlyArray<ToastItem>;
  onDismiss: (id: string) => void;
};

function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-4 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
      role="region"
      aria-label="notifications"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

type ToastCardProps = {
  toast: ToastItem;
  onDismiss: (id: string) => void;
};

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    if (!toast.persist) {
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onDismiss(toast.id), 200);
      }, AUTO_DISMISS_MS);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.id, toast.persist, onDismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-md motion-safe:transition-all motion-safe:duration-200',
        toast.title ? 'max-w-sm' : 'max-w-xs',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
        toast.kind === 'error'
          ? 'border-danger/30 bg-subtle text-danger'
          : toast.kind === 'success'
            ? 'border-success/30 bg-subtle text-success'
            : toast.kind === 'info'
              ? 'border-info/30 bg-subtle text-info'
              : 'border-warning/30 bg-subtle text-warning',
      )}
      role="alert"
    >
      <div className="min-w-0 flex-1">
        {toast.title ? <p className="text-xs font-semibold leading-snug">{toast.title}</p> : null}
        {toast.message ? (
          <p
            className={cn(
              'whitespace-pre-line break-words text-xs leading-snug',
              toast.title && 'mt-0.5 line-clamp-4 text-foreground/80',
            )}
          >
            {toast.message}
          </p>
        ) : null}
        {toast.context ? (
          <p className="mt-1 truncate text-2xs opacity-70">{toast.context}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="mt-0.5 shrink-0 opacity-60 hover:opacity-100"
        onClick={() => onDismiss(toast.id)}
        aria-label="dismiss notification"
      >
        <X size={12} aria-hidden />
      </button>
    </div>
  );
}
