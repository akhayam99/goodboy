import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
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

const KIND_ICON = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
} as const;

const KIND_CLASSES = {
  error: {
    card: 'border-danger/25 bg-elevated',
    strip: 'bg-danger',
    icon: 'text-danger',
  },
  warning: {
    card: 'border-warning/25 bg-elevated',
    strip: 'bg-warning',
    icon: 'text-warning',
  },
  success: {
    card: 'border-success/25 bg-elevated',
    strip: 'bg-success',
    icon: 'text-success',
  },
  info: {
    card: 'border-info/25 bg-elevated',
    strip: 'bg-info',
    icon: 'text-info',
  },
} as const;

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

  const { card, strip, icon } = KIND_CLASSES[toast.kind];
  const Icon = KIND_ICON[toast.kind];
  const hasTitle = Boolean(toast.title);
  const assertive = toast.kind === 'error' || toast.kind === 'warning';

  return (
    <div
      className={cn(
        'pointer-events-auto flex min-w-[22rem] max-w-[30rem] overflow-hidden rounded-lg border shadow-lg motion-safe:transition-all motion-safe:duration-200',
        card,
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
      )}
      role={assertive ? 'alert' : 'status'}
    >
      <div className={cn('w-1 shrink-0', strip)} />
      <div className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3">
        <Icon size={16} className={cn('mt-px shrink-0', icon)} aria-hidden />
        <div className="min-w-0 flex-1">
          {hasTitle ? (
            <p className="text-sm font-semibold leading-snug text-foreground">{toast.title}</p>
          ) : null}
          {toast.message ? (
            <p
              className={cn(
                'break-words text-xs leading-snug',
                hasTitle ? 'mt-0.5 text-muted-foreground' : 'text-foreground',
              )}
            >
              {toast.message}
            </p>
          ) : null}
          {toast.context ? (
            <p className="mt-1.5 line-clamp-2 text-2xs text-muted-foreground/70">{toast.context}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground"
          onClick={() => onDismiss(toast.id)}
          aria-label="dismiss notification"
        >
          <X size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}
