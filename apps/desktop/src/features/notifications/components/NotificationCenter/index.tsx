import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCircle, AlertCircle, AlertTriangle, Info, Trash2 } from 'lucide-react';
import { Divider, Popover, ScrollFade, Select, Tooltip, cn } from '@goodboy/ui';
import { Fragment } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Notification, NotificationAction, NotificationSeverity } from '@goodboy/db';
import { PROVIDER_CAPABILITIES, resolveTaskModel } from '@goodboy/core';
import type { ProviderId, TaskModelPreference } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { mapNotificationAction } from '../NotificationToastBridge';
import { PROVIDER_LABEL } from '../../../chat/utils/chat-constants';
import { ModelSelect } from '../../../session/components/ModelSelect';

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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const DROPDOWN_WIDTH = 320;
const VIEWPORT_MARGIN = 8;

export const NotificationCenter = () => {
  const notifications = useAppStore((s) => s.notifications);
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
      const openAbove = spaceBelow < 300;
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
    <div role="region" aria-label="notifications" aria-live="polite">
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
          aria-label={`notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        >
          <Bell size={14} aria-hidden />
          {unread > 0 && (
            <span
              className={cn(
                'absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-warning px-1 font-bold leading-none text-warning-foreground tabular-nums',
                unread > 9 ? 'text-[9px]' : 'text-2xs',
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
                      aria-label="clear all notifications"
                      title="Clear all notifications"
                    >
                      <Trash2 size={11} aria-hidden />
                      Clear all
                    </button>
                  )}
                </header>
                <Divider />
                {notifications.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No notifications
                  </p>
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
                          <NotificationItem notification={n} />
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
  notification: Notification;
};

function NotificationItem({ notification: n }: NotificationItemProps) {
  const store = useAppStore.getState();
  const action = n.action != null ? mapNotificationAction(n.action, store) : undefined;
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <li className={cn('flex items-start gap-2 px-3 py-2.5', !n.read && 'bg-muted/40')}>
      <span className={cn('mt-0.5 shrink-0', severityClass(n.severity))}>
        {severityIcon(n.severity)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground leading-snug">{n.title}</p>
        {n.body && (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-snug text-muted-foreground">
            {n.body}
          </p>
        )}
        <p className="mt-0.5 text-2xs text-muted-foreground/70">{relativeTime(n.ts)}</p>
        {action != null ? (
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-2xs font-medium text-foreground/80 ring-1 ring-inset ring-foreground/20 hover:bg-muted hover:text-foreground"
              onClick={action.onClick}
            >
              {action.label}
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setPickerOpen((v) => !v)}
            >
              Retry with…
            </button>
          </div>
        ) : null}
        {action != null && pickerOpen && n.action != null ? (
          <RetryWithPicker action={n.action} onDone={() => setPickerOpen(false)} />
        ) : null}
      </div>
    </li>
  );
}

type RetryWithPickerProps = {
  readonly action: NotificationAction;
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
  if (providerId == null) {
    return null;
  }
  const recommendedModel = resolveTaskModel('summarizer', null, providerId).model;
  const dispatch = () => {
    const override: TaskModelPreference =
      model === '' ? resolveTaskModel('summarizer', null, providerId) : { providerId, model };
    const store = useAppStore.getState();
    if (action.kind === 'retry-summarizer') {
      store.retrySummarizer(action.sessionId, override);
    } else {
      void store.retryStepSummary({
        sessionId: action.sessionId,
        agentId: action.agentId,
        taskModelOverride: override,
      });
    }
    onDone();
  };
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <Select
        size="sm"
        aria-label="retry provider"
        value={providerId}
        onChange={(event) => {
          setProviderId(event.target.value as ProviderId);
          setModel('');
        }}
      >
        {availableProviderIds.map((candidate) => (
          <option key={candidate} value={candidate}>
            {PROVIDER_LABEL[candidate]}
          </option>
        ))}
      </Select>
      <div className="min-w-0 flex-1">
        <ModelSelect
          provider={providerId}
          value={model}
          onChange={setModel}
          disabled={false}
          allowAuto
          recommendedModel={recommendedModel}
        />
      </div>
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-2xs font-medium text-foreground/80 ring-1 ring-inset ring-foreground/20 hover:bg-muted hover:text-foreground"
        onClick={dispatch}
        aria-label="confirm retry with selected model"
      >
        Retry
      </button>
    </div>
  );
}
