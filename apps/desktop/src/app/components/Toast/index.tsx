import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { ToastStack } from './ToastStack';
import type { ToastAction, ToastItem, ToastKind } from './types';

export type { ToastAction, ToastItem, ToastKind } from './types';

export type ShowToastOptions = {
  readonly title?: string;
  readonly context?: string;
  readonly persist?: boolean;
  readonly action?: ToastAction;
};

type ToastContextValue = {
  showToast: (kind: ToastKind, message: string, opts?: ShowToastOptions) => void;
};

type ToastLiftValue = {
  setLift: (params: { id: string; bottom: number | null }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const ToastLiftContext = createContext<ToastLiftValue | null>(null);

const LIFT_GAP_PX = 8;

const OPEN_NOTIFICATIONS_EVENT = 'goodboy:open-notifications';

type ToastProviderProps = {
  readonly children: ReactNode;
};

const isSameToast = ({ a, b }: { a: ToastItem; b: Omit<ToastItem, 'id' | 'count' | 'revision'> }) =>
  a.kind === b.kind && a.title === b.title && a.message === b.message;

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<ReadonlyArray<ToastItem>>([]);
  const [lifts, setLifts] = useState<Readonly<Record<string, number>>>({});

  const showToast = useCallback((kind: ToastKind, message: string, opts?: ShowToastOptions) => {
    const next = {
      kind,
      message: message.length > 0 ? message.charAt(0).toUpperCase() + message.slice(1) : message,
      title: opts?.title,
      context: opts?.context,
      persist: opts?.persist === true,
      action: opts?.action,
    };
    setToasts((prev) => {
      const match = prev.find((toast) => isSameToast({ a: toast, b: next }));
      if (match !== undefined) {
        return prev.map((toast) =>
          toast.id === match.id
            ? { ...toast, count: toast.count + 1, revision: toast.revision + 1 }
            : toast,
        );
      }
      return [...prev, { ...next, id: crypto.randomUUID(), count: 1, revision: 0 }];
    });
  }, []);

  const dismiss = useCallback(({ id }: { id: string }) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const openOverflow = useCallback(
    ({ suppressedIds }: { suppressedIds: ReadonlyArray<string> }) => {
      const hidden = new Set(suppressedIds);
      setToasts((prev) => prev.filter((toast) => !hidden.has(toast.id)));
      window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT));
    },
    [],
  );

  const setLift = useCallback(({ id, bottom }: { id: string; bottom: number | null }) => {
    setLifts((prev) => {
      if (bottom === null) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      if (prev[id] === bottom) {
        return prev;
      }
      return { ...prev, [id]: bottom };
    });
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);
  const liftValue = useMemo(() => ({ setLift }), [setLift]);
  const liftValues = Object.values(lifts);
  const bottom = liftValues.length > 0 ? Math.max(...liftValues) : null;

  return (
    <ToastContext.Provider value={value}>
      <ToastLiftContext.Provider value={liftValue}>
        {children}
        <ToastStack
          toasts={toasts}
          bottom={bottom}
          onDismiss={dismiss}
          onOpenOverflow={openOverflow}
        />
      </ToastLiftContext.Provider>
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

export const useToastLift = ({ ref }: { ref: RefObject<HTMLElement | null> }) => {
  const lift = useContext(ToastLiftContext);
  const setLift = lift?.setLift;
  useEffect(() => {
    const el = ref.current;
    if (setLift === undefined || el === null) {
      return;
    }
    const id = crypto.randomUUID();
    const measure = () => {
      const { top } = el.getBoundingClientRect();
      setLift({ id, bottom: Math.round(window.innerHeight - top + LIFT_GAP_PX) });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      setLift({ id, bottom: null });
    };
  }, [ref, setLift]);
};
