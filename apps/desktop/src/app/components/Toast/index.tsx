import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { ToastStack } from './ToastStack';
import type { ToastAction, ToastItem, ToastKind } from './types';

export type { ToastAction, ToastItem, ToastKind } from './types';

type ShowToastKind = Exclude<ToastKind, 'error'>;

type ShowToastParams = {
  readonly kind: ShowToastKind;
  readonly message: string;
  readonly title?: string;
  readonly context?: string;
  readonly persist?: boolean;
  readonly action?: ToastAction;
  readonly onDismiss?: () => void;
};

export type ShowToast = (params: ShowToastParams) => void;

export type PreviewNotificationParams = {
  readonly severity: ToastKind;
  readonly title: string;
  readonly message: string;
  readonly context?: string;
  readonly action?: ToastAction;
  readonly persist: boolean;
  readonly onDismiss?: () => void;
};

type ToastContextValue = {
  showToast: ShowToast;
  previewNotification: (params: PreviewNotificationParams) => void;
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
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;
  const [lifts, setLifts] = useState<Readonly<Record<string, number>>>({});

  const pushToast = useCallback((next: Omit<ToastItem, 'id' | 'count' | 'revision'>) => {
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

  const showToast = useCallback(
    ({ kind, message, title, context, persist, action, onDismiss }: ShowToastParams) => {
      pushToast({ kind, message, title, context, persist: persist === true, action, onDismiss });
    },
    [pushToast],
  );

  const previewNotification = useCallback(
    ({
      severity,
      title,
      message,
      context,
      action,
      persist,
      onDismiss,
    }: PreviewNotificationParams) => {
      pushToast({ kind: severity, title, message, context, action, persist, onDismiss });
    },
    [pushToast],
  );

  const removeToasts = useCallback(({ ids }: { ids: ReadonlySet<string> }) => {
    toastsRef.current.filter((toast) => ids.has(toast.id)).forEach((toast) => toast.onDismiss?.());
    setToasts((prev) => prev.filter((toast) => !ids.has(toast.id)));
  }, []);

  const dismiss = useCallback(
    ({ id }: { id: string }) => removeToasts({ ids: new Set([id]) }),
    [removeToasts],
  );

  const openOverflow = useCallback(
    ({ suppressedIds }: { suppressedIds: ReadonlyArray<string> }) => {
      removeToasts({ ids: new Set(suppressedIds) });
      window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT));
    },
    [removeToasts],
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

  const value = useMemo(
    () => ({ showToast, previewNotification }),
    [showToast, previewNotification],
  );
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
