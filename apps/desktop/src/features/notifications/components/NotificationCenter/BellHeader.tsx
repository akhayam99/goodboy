import { Button, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { PopoverView, ScopeValue } from './bellTypes';

type Elsewhere = {
  readonly count: number;
  readonly tone: 'warning' | 'danger' | null;
};

type Props = {
  readonly hasNotifications: boolean;
  readonly unread: number;
  readonly view: PopoverView;
  readonly onViewChange: (next: PopoverView) => void;
  readonly onMarkAllRead: () => void;
  readonly hasManyWorkspaces: boolean;
  readonly scope: ScopeValue;
  readonly elsewhere: Elsewhere;
  readonly onScopeChange: (next: ScopeValue) => void;
};

export const BellHeader = ({
  hasNotifications,
  unread,
  view,
  onViewChange,
  onMarkAllRead,
  hasManyWorkspaces,
  scope,
  elsewhere,
  onScopeChange,
}: Props) => {
  const scopeOptions: ReadonlyArray<SegmentedTabOption<ScopeValue>> = [
    { value: 'workspace', label: 'This workspace' },
    {
      value: 'all',
      label: 'All workspaces',
      badge:
        elsewhere.count > 0 ? (
          <span
            data-bell-elsewhere={elsewhere.tone ?? 'warning'}
            className="tabular-nums text-warning"
          >
            {elsewhere.count}
          </span>
        ) : undefined,
    },
  ];
  const viewOptions: ReadonlyArray<SegmentedTabOption<PopoverView>> = [
    {
      value: 'unread',
      label: 'Unread',
      badge: <span className="tabular-nums text-muted-foreground">{unread}</span>,
    },
    { value: 'all', label: 'All' },
  ];
  return (
    <>
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-meta font-semibold text-foreground">Notifications</span>
        {hasNotifications ? (
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
                Mark all read
              </Button>
            )}
            <SegmentedTabs
              ariaLabel="Show unread or all notifications"
              options={viewOptions}
              value={view}
              onChange={onViewChange}
              size="sm"
            />
          </div>
        ) : null}
      </header>
      {hasManyWorkspaces ? (
        <div className="flex px-3 pb-2">
          <SegmentedTabs
            ariaLabel="Show this workspace or all workspaces"
            options={scopeOptions}
            value={scope}
            onChange={onScopeChange}
            size="sm"
          />
        </div>
      ) : null}
    </>
  );
};
