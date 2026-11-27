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
import { mergedDismissOf } from './mergedDismissOf';
import { mergedIdsOf } from './mergedIdsOf';
import { ToastStack } from './ToastStack';
import { useToastRight } from './useToastRight';
import {
  ToastContext,
  type PreviewNotificationParams,
  type RemoveNotificationIdsParams,
  type ShowToastParams,
  type ToastContextValue,
} from './toastContext';
import type { ToastAction, ToastItem } from './types';

export type { ToastAction, ToastItem } from './types';

export type { PreviewNotificationParams, ShowToast } from './toastContext';

type ToastLiftValue = {
  setLift: (params: { id: string; bottom: number | null }) => void;
};

const ToastLiftContext = createContext<ToastLiftValue | null>(null);

const LIFT_GAP_PX = 8;

const OPEN_NOTIFICATIONS_EVENT = 'goodboy:open-notifications';

type ToastProviderProps = {
  readonly children: ReactNode;
};

const isSameToast = ({
  a,
  b,
}: {
  a: ToastItem;
  b: Omit<ToastItem, 'id' | 'count' | 'revision'>;
}) => {
  if (a.kind !== b.kind) {
    return false;
  }
  if (
    a.notificationIds !== undefined &&
    b.notificationIds !== undefined &&
    a.dedupeKey !== undefined
  ) {
    return a.dedupeKey === b.dedupeKey;
  }
  return a.dedupeKey === b.dedupeKey && a.title === b.title && a.message === b.message;
};

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
            ? {
                ...toast,
                ...(next.notificationIds === undefined
                  ? {}
                  : {
                      title: next.title,
                      message: next.message,
                      context: next.context,
                      action: next.action,
                    }),
                notificationIds: mergedIdsOf({ a: toast.notificationIds, b: next.notificationIds }),
                onDismiss: mergedDismissOf({ a: toast.onDismiss, b: next.onDismiss }),
                count: toast.count + 1,
                revision: toast.revision + 1,
              }
            : toast,
        );
      }
      return [...prev, { ...next, id: crypto.randomUUID(), count: 1, revision: 0 }];
    });
  }, []);

  const showToast = useCallback(
    ({ dedupeKey, kind, message, title, context, persist, action, onDismiss }: ShowToastParams) => {
      pushToast({
        dedupeKey,
        kind,
        message,
        title,
        context,
        persist: persist === true,
        action,
        onDismiss,
      });
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
      dedupeKey,
      notificationIds,
    }: PreviewNotificationParams) => {
      pushToast({
        dedupeKey,
        notificationIds,
        kind: severity,
        title,
        message,
        context,
        action,
        persist,
        onDismiss,
      });
    },
    [pushToast],
  );

  const removeToasts = useCallback(({ ids }: { ids: ReadonlySet<string> }) => {
    toastsRef.current.filter((toast) => ids.has(toast.id)).forEach((toast) => toast.onDismiss?.());
    setToasts((prev) => prev.filter((toast) => !ids.has(toast.id)));
  }, []);

  const removeNotificationIds = useCallback(({ ids }: RemoveNotificationIdsParams) => {
    const dropped = toastsRef.current.filter((toast) => {
      const held = toast.notificationIds;
      return held !== undefined && held.length > 0 && held.every((id) => ids.has(id));
    });
    dropped.forEach((toast) => toast.onDismiss?.());
    setToasts((prev) =>
      prev.flatMap((toast) => {
        const held = toast.notificationIds;
        if (held === undefined) {
          return [toast];
        }
        const remaining = held.filter((id) => !ids.has(id));
        if (remaining.length === held.length) {
          return [toast];
        }
        if (remaining.length === 0) {
          return [];
        }
        return [
          { ...toast, notificationIds: remaining, count: Math.min(toast.count, remaining.length) },
        ];
      }),
    );
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
    () => ({ showToast, previewNotification, removeNotificationIds }),
    [showToast, previewNotification, removeNotificationIds],
  );
  const liftValue = useMemo(() => ({ setLift }), [setLift]);
  const liftValues = Object.values(lifts);
  const bottom = liftValues.length > 0 ? Math.max(...liftValues) : null;
  const right = useToastRight({ isActive: toasts.length > 0 });

  return (
    <ToastContext.Provider value={value}>
      <ToastLiftContext.Provider value={liftValue}>
        {children}
        <ToastStack
          toasts={toasts}
          bottom={bottom}
          right={right}
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
