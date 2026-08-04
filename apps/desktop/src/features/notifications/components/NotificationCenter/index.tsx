import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCircle, AlertCircle, AlertTriangle, Info, Trash2 } from 'lucide-react';
import {
  Button,
  Divider,
  EmptyState,
  Popover,
  ScrollFade,
  Skeleton,
  Tooltip,
  cn,
} from '@goodboy/ui';
import { Fragment } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Notification, NotificationAction, NotificationSeverity } from '@goodboy/db';
import { PROVIDER_CAPABILITIES, resolveTaskModel } from '@goodboy/core';
import type { ModelEffort, ProviderId, TaskModelPreference } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { mapNotificationAction } from '../NotificationToastBridge';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';

function severityIcon(severity: NotificationSeverity, size = 13) {
  switch (severity) {
    case 'success':
      return <CheckCircle size={size} aria-hidden />;
    case 'warning':
      return <AlertTriangle size={size} aria-hidden />;
    case 'error':
      return <AlertCircle size={size} aria-hidden />;
    default:
      return <Info size={size} aria-hidden />;
  }
}

function severityClass(severity: NotificationSeverity): string {
  switch (severity) {
    case 'success':
      return 'text-success';
    case 'warning':
      return 'text-warning';
    case 'error':
      return 'text-danger';
    default:
      return 'text-info';
  }
}

const DROPDOWN_WIDTH = 320;
const VIEWPORT_MARGIN = 8;
const LIST_MAX_HEIGHT = 320;
const HEADER_HEIGHT = 37;
const DROPDOWN_MAX_HEIGHT = LIST_MAX_HEIGHT + HEADER_HEIGHT;

export const NotificationCenter = () => {
  const notifications = useAppStore((s) => s.notifications);
  const notificationsLoading = useAppStore((s) => s.notificationsLoading);
  const loadNotifications = useAppStore((s) => s.loadNotifications);
  const markNotificationsRead = useAppStore((s) => s.markNotificationsRead);
  const clearNotifications = useAppStore((s) => s.clearNotifications);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number } | null>(
    null,
  );

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const handleOpenRequest = () => {
      setOpen((prev) => {
        if (!prev) {
          void markNotificationsRead();
        }
        return true;
      });
    };
    window.addEventListener('goodboy:open-notifications', handleOpenRequest);
    return () => {
      window.removeEventListener('goodboy:open-notifications', handleOpenRequest);
    };
  }, [markNotificationsRead]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const updatePosition = () => {
      const el = triggerRef.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const desiredLeft = centerX - DROPDOWN_WIDTH / 2;
      const maxLeft = window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_MARGIN;
      const left = Math.min(Math.max(desiredLeft, VIEWPORT_MARGIN), maxLeft);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openAbove = spaceBelow < DROPDOWN_MAX_HEIGHT + VIEWPORT_MARGIN;
      const top = openAbove ? undefined : rect.bottom + 6;
      const bottom = openAbove ? window.innerHeight - rect.top + 6 : undefined;
      setCoords({ top, bottom, left });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) {
      void markNotificationsRead();
    }
  };

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div role="region" aria-label="Notifications" aria-live="polite">
      <Tooltip content="notifications" side="top">
        <button
          ref={triggerRef}
          type="button"
          onClick={handleOpen}
          className={cn(
            'relative flex items-center justify-center rounded p-1.5 motion-safe:transition-colors',
            open
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        >
          <Bell size={14} aria-hidden />
          {unread > 0 && (
            <span
              className={cn(
                'absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-warning px-1 font-bold leading-none text-warning-foreground tabular-nums',
                unread > 9 ? 'text-3xs' : 'text-2xs',
              )}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </Tooltip>

      {open && coords
        ? createPortal(
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
              <Popover
                className="fixed z-40 w-80"
                style={{ top: coords.top, bottom: coords.bottom, left: coords.left }}
              >
                <header className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-xs font-semibold text-foreground">
                    {notifications.length}{' '}
                    {notifications.length === 1 ? 'notification' : 'notifications'}
                  </span>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void clearNotifications()}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label="Clear all notifications"
                      title="Clear all notifications"
                    >
                      <Trash2 size={11} aria-hidden />
                      Clear all
                    </button>
                  )}
                </header>
                <Divider />
                {notificationsLoading && notifications.length === 0 ? (
                  <div
                    className="flex flex-col gap-3 px-3 py-2.5"
                    role="status"
                    aria-label="Loading notifications"
                  >
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Skeleton className="mt-0.5 size-3.5 shrink-0 rounded-full" />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <Skeleton className="h-3 w-2/3 rounded" />
                          <Skeleton className="h-2.5 w-1/3 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <EmptyState
                    icon={CONCEPT_ICONS.notifications}
                    tone={CONCEPT_TONE.notifications}
                    title="Nothing to catch up on"
                    description="Session milestones, retries, and budget alerts land here as they happen, so you don't have to babysit a running session."
                    size="inline"
                    action={
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setOpen(false);
                          window.dispatchEvent(new CustomEvent('goodboy:new-session'));
                        }}
                      >
                        Start a session
                      </Button>
                    }
                    className="px-3 py-6"
                  />
                ) : (
                  <ScrollFade className="max-h-80" fadeSize={16}>
                    <ul>
                      {notifications.map((n, i) => (
                        <Fragment key={n.id}>
                          {i > 0 && (
                            <li aria-hidden className="px-3">
                              <Divider />
                            </li>
                          )}
                          <NotificationItem notification={n} onNavigated={() => setOpen(false)} />
                        </Fragment>
                      ))}
                    </ul>
                  </ScrollFade>
                )}
              </Popover>
            </>,
            document.body,
          )
        : null}
    </div>
  );
};

type NotificationItemProps = {
  readonly notification: Notification;
  readonly onNavigated: () => void;
};

const NotificationItem = ({ notification: n, onNavigated }: NotificationItemProps) => {
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const store = useAppStore.getState();
  const action = n.action != null ? mapNotificationAction(n.action, store) : undefined;
  const retryAction =
    n.action?.kind === 'retry-summarizer' || n.action?.kind === 'retry-step-summary'
      ? n.action
      : null;
  const [pickerOpen, setPickerOpen] = useState(false);
  const sessionId = n.sessionId;
  const agentId = n.action?.kind === 'retry-step-summary' ? n.action.agentId : null;

  const body = (
    <>
      <span className={cn('mt-0.5 shrink-0', severityClass(n.severity))}>
        {severityIcon(n.severity)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs font-medium leading-snug text-foreground">{n.title}</span>
        {n.body != null && n.body !== '' ? (
          <span
            title={n.body}
            className="line-clamp-2 whitespace-pre-wrap break-words text-xs leading-snug text-muted-foreground"
          >
            {n.body}
          </span>
        ) : null}
        <span className="text-2xs text-muted-foreground/70">
          {formatRelativeAge({ fromIso: n.ts })}
        </span>
      </span>
    </>
  );

  const navigate = () => {
    if (sessionId == null) {
      return;
    }
    const workspaceId = n.workspaceId;
    void (async () => {
      if (workspaceId != null && workspaceId !== useAppStore.getState().currentWorkspaceId) {
        await setCurrentWorkspace(workspaceId);
      }
      const state = useAppStore.getState();
      if (!state.sessions.some((candidate) => candidate.id === sessionId)) {
        return;
      }
      if (state.currentSessionId === sessionId) {
        setActiveLens(sessionId, null);
      } else {
        await setCurrentSession(sessionId);
      }
      if (agentId == null) {
        return;
      }
      await selectAgent(sessionId, agentId);
    })().catch(() => {});
    onNavigated();
  };

  return (
    <li className={cn('flex flex-col gap-1 px-3 py-2.5', !n.read && 'bg-muted/40')}>
      {sessionId == null ? (
        <span className="flex items-start gap-2">{body}</span>
      ) : (
        <button
          type="button"
          onClick={navigate}
          className="flex w-full items-start gap-2 rounded-md text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          {body}
        </button>
      )}
      {action != null ? (
        <div className="flex items-center gap-1.5 pl-5">
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-2xs font-medium text-foreground/80 ring-1 ring-inset ring-foreground/20 hover:bg-muted hover:text-foreground"
            onClick={action.onClick}
          >
            {action.label}
          </button>
          {retryAction != null && (
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setPickerOpen((v) => !v)}
            >
              Retry with…
            </button>
          )}
        </div>
      ) : null}
      {action != null && pickerOpen && retryAction != null ? (
        <div className="pl-5">
          <RetryWithPicker action={retryAction} onDone={() => setPickerOpen(false)} />
        </div>
      ) : null}
    </li>
  );
};

type RetryAction = Extract<
  NotificationAction,
  { kind: 'retry-summarizer' } | { kind: 'retry-step-summary' }
>;

type RetryWithPickerProps = {
  readonly action: RetryAction;
  readonly onDone: () => void;
};

function RetryWithPicker({ action, onDone }: RetryWithPickerProps) {
  const connectedProviderIds = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );
  const sessionProvider = useAppStore(
    (s) => s.sessions.find((x) => x.id === action.sessionId)?.providerPreference.defaultProvider,
  );
  const availableProviderIds = connectedProviderIds.filter(
    (candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0,
  );
  const initialProvider =
    sessionProvider != null && availableProviderIds.includes(sessionProvider)
      ? sessionProvider
      : availableProviderIds[0];
  const [providerId, setProviderId] = useState<ProviderId | undefined>(initialProvider);
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState<ModelEffort>('medium');
  if (providerId == null) {
    return null;
  }
  const recommendedModel = resolveTaskModel('summarizer', null, providerId).model;
  const dispatch = () => {
    const taskModel =
      model === '' ? resolveTaskModel('summarizer', null, providerId) : { providerId, model };
    const override: TaskModelPreference = { ...taskModel, effort };
    const store = useAppStore.getState();
    switch (action.kind) {
      case 'retry-summarizer':
        store.retrySummarizer(action.sessionId, override);
        break;
      case 'retry-step-summary':
        void store.retryStepSummary({
          sessionId: action.sessionId,
          agentId: action.agentId,
          taskModelOverride: override,
        });
        break;
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
    onDone();
  };
  return (
    <div className="flex items-center gap-1.5 pt-1.5">
      <div className="min-w-0 flex-1">
        <RoutingPicker
          ariaLabel="Retry routing"
          connectedProviders={availableProviderIds}
          provider={providerId}
          model={model}
          effort={{ editable: true, value: effort, onChange: setEffort }}
          recommendation={{ model: recommendedModel }}
          disabled={false}
          onProvider={(next) => {
            if (next === '') {
              return;
            }
            setProviderId(next);
            setModel('');
          }}
          onModel={setModel}
        />
      </div>
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-2xs font-medium text-foreground/80 ring-1 ring-inset ring-foreground/20 hover:bg-muted hover:text-foreground"
        onClick={dispatch}
        aria-label="Confirm retry with selected model"
      >
        Retry
      </button>
    </div>
  );
}
