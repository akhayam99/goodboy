import type { ReactNode } from 'react';
import { Button, StatusDot, cn, tintClasses } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly pager: string | null;
  readonly preview: ReactNode;
  readonly isMessageTyped: boolean;
  readonly canAct: boolean;
  readonly isBusy: boolean;
  readonly alwaysAllowLabel: string;
  readonly openAsker: ReactNode;
  readonly moreActions: ReactNode;
  readonly onAllow: () => void;
  readonly onAlwaysAllow: () => void;
  readonly onDeny: () => void;
};

const DENIES_BY_MESSAGE = 'Your message will deny this, with your text as the reason.';

const ALLOW = 'Allow and continue';

export const PermissionDockAsk = ({
  title,
  pager,
  preview,
  isMessageTyped,
  canAct,
  isBusy,
  alwaysAllowLabel,
  openAsker,
  moreActions,
  onAllow,
  onAlwaysAllow,
  onDeny,
}: Props) => (
  <div
    data-dock-row=""
    data-dock-ask="permission"
    className="flex min-w-0 flex-col gap-2 motion-safe:animate-fade-in"
  >
    <div className="flex min-h-6 min-w-0 items-center gap-2 text-row">
      <StatusDot tone="warning" size="sm" />
      <span className={cn('min-w-0 flex-1 truncate', tintClasses('warning').text)}>{title}</span>
      {pager === null ? null : (
        <span className="shrink-0 text-meta text-faint-foreground">{pager}</span>
      )}
    </div>
    {preview}
    {isMessageTyped ? <p className="text-meta text-muted-foreground">{DENIES_BY_MESSAGE}</p> : null}
    {canAct ? (
      <div className="flex min-w-0 items-end gap-2">
        {isMessageTyped ? (
          <Button variant="quiet" size="xs" disabled={isBusy} onClick={onAllow}>
            {ALLOW}
          </Button>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              <Button variant="quiet" size="xs" disabled={isBusy} onClick={onAlwaysAllow}>
                {alwaysAllowLabel}
              </Button>
              <Button variant="ghost-danger" size="xs" disabled={isBusy} onClick={onDeny}>
                Deny
              </Button>
              {openAsker}
              {moreActions}
            </div>
            <Button size="sm" className="shrink-0" disabled={isBusy} onClick={onAllow}>
              {ALLOW}
            </Button>
          </>
        )}
      </div>
    ) : null}
  </div>
);
