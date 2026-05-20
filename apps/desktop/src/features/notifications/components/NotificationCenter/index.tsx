import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCircle, AlertCircle, AlertTriangle, Info, X, Trash2 } from 'lucide-react';
import { Tooltip, cn } from '@goodboy/ui';
import type { Notification, NotificationSeverity } from '@goodboy/db';
import { useAppStore } from '../../../../store';

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
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const DROPDOWN_WIDTH = 320;
const VIEWPORT_MARGIN = 8;

export function NotificationCenter() {
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

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const desiredLeft = rect.right - DROPDOWN_WIDTH;
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
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-2xs font-bold leading-none text-warning-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </Tooltip>

      {open && coords
        ? createPortal(
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
              <div
                className="fixed z-40 w-80 overflow-hidden rounded-lg border border-border bg-subtle shadow-lg"
                style={{ top: coords.top, bottom: coords.bottom, left: coords.left }}
              >
                <header className="flex items-center justify-between border-b border-border-soft px-3 py-2">
                  <span className="text-xs font-semibold text-foreground">notifications</span>
                  <div className="flex items-center gap-2">
                    {notifications.length > 0 && (
                      <Tooltip content="clear all" side="left">
                        <button
                          type="button"
                          onClick={() => void clearNotifications()}
                          className="text-muted-foreground hover:text-danger"
                          aria-label="clear all notifications"
                        >
                          <Trash2 size={12} aria-hidden />
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip content="close" side="left">
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="close notifications"
                      >
                        <X size={13} aria-hidden />
                      </button>
                    </Tooltip>
                  </div>
                </header>

                {notifications.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    no notifications
                  </p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto divide-y divide-border-soft">
                    {notifications.map((n) => (
                      <NotificationItem key={n.id} notification={n} />
                    ))}
                  </ul>
                )}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
}

function NotificationItem({ notification: n }: NotificationItemProps) {
  return (
    <li className={cn('flex items-start gap-2 px-3 py-2.5', !n.read && 'bg-muted/40')}>
      <span className={cn('mt-0.5 shrink-0', severityClass(n.severity))}>
        {severityIcon(n.severity)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground leading-snug">{n.title}</p>
        {n.body && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug truncate">{n.body}</p>
        )}
        <p className="mt-0.5 text-2xs text-muted-foreground/70">{relativeTime(n.ts)}</p>
      </div>
    </li>
  );
}
