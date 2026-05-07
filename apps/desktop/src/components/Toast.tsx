import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@kay-am/ui';

export type ToastKind = 'warning' | 'error';

export interface ToastItem {
  readonly id: string;
  readonly kind: ToastKind;
  readonly message: string;
}

interface ToastContextValue {
  showToast: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ReadonlyArray<ToastItem>>([]);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, kind, message }]);
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
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

interface ToastStackProps {
  toasts: ReadonlyArray<ToastItem>;
  onDismiss: (id: string) => void;
}

function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2"
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

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 200);
    }, AUTO_DISMISS_MS);

    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [toast.id, onDismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex max-w-xs items-start gap-2 rounded-lg border px-3 py-2.5 shadow-md transition-all duration-200',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
        toast.kind === 'error'
          ? 'border-danger/30 bg-background text-danger'
          : 'border-warning/30 bg-background text-warning',
      )}
      role="alert"
    >
      <span className="flex-1 text-xs leading-snug">{toast.message}</span>
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
