import { BAND_ROW_CLASS, Button, InlineConfirm, cn, tintClasses } from '@goodboy/ui';
import { LogIn, Unplug } from 'lucide-react';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import type { AccountGroupProps } from './types';

const dangerTint = tintClasses('danger');

const identityLine = ({
  identity,
  planLabel,
}: {
  readonly identity: string | null;
  readonly planLabel: string | null;
}): string => {
  const who = identity ?? 'Connected';
  return planLabel === null ? who : `${who} · ${planLabel} plan`;
};

export const SignedInRow = ({
  info,
  planLabel,
  canReauth,
  confirm,
  onConfirmChange,
  onReauth,
  onConfirmReauth,
  onDisconnect,
}: AccountGroupProps) => {
  if (confirm === 'reauth') {
    return (
      <InlineConfirm
        role="alert"
        icon={<LogIn size={ICON_SIZE.row} aria-hidden />}
        title={`Sign in to ${info.label} again?`}
        description={`Signing in again signs you out of ${info.label} first.`}
        confirmLabel="Sign in again"
        surface="plain"
        onConfirm={() => {
          onConfirmChange('none');
          onConfirmReauth();
        }}
        onCancel={() => onConfirmChange('none')}
      />
    );
  }
  if (confirm === 'disconnect') {
    return (
      <InlineConfirm
        role="alert"
        icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
        title={`Disconnect ${info.label}?`}
        description="Signs the CLI out on this machine. Connect again to sign back in."
        confirmLabel="Disconnect"
        surface="plain"
        onConfirm={() => {
          onConfirmChange('none');
          onDisconnect();
        }}
        onCancel={() => onConfirmChange('none')}
      />
    );
  }
  return (
    <div className={cn(BAND_ROW_CLASS, 'gap-3 text-label')}>
      <span className="w-28 shrink-0 text-muted-foreground">Signed in</span>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {identityLine({ identity: info.identity, planLabel })}
      </span>
      {canReauth ? (
        <Button variant="secondary" size="sm" onClick={onReauth}>
          Sign in again
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onConfirmChange('disconnect')}
        className={cn('text-danger', dangerTint.hoverBg, 'hover:text-danger')}
      >
        Disconnect
      </Button>
    </div>
  );
};
