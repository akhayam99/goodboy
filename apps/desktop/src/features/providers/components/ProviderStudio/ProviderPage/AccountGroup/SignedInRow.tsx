import { Button, ConfirmPopover, cn, tintClasses } from '@goodboy/ui';
import { LogIn, Unplug } from 'lucide-react';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { ConnectionTest } from './ConnectionTest';
import type { AccountGroupProps } from './types';

const dangerTint = tintClasses('danger');

type IdentityParams = { readonly identity: string | null; readonly planLabel: string | null };

const identityLine = ({ identity, planLabel }: IdentityParams): string => {
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
  return (
    <ConnectionTest info={info} onReauth={onReauth}>
      <span className="w-28 shrink-0 text-muted-foreground">Signed in</span>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {identityLine({ identity: info.identity, planLabel })}
      </span>
      {canReauth ? (
        <ConfirmPopover
          role="alert"
          icon={<LogIn size={ICON_SIZE.row} aria-hidden />}
          title={`Sign in to ${info.label} again?`}
          description={`Signing in again signs you out of ${info.label} first.`}
          confirmLabel="Sign in again"
          isOpen={confirm === 'reauth'}
          onConfirm={() => {
            onConfirmChange('none');
            onConfirmReauth();
          }}
          onCancel={() => onConfirmChange('none')}
          trigger={() => (
            <Button variant="secondary" size="sm" onClick={onReauth}>
              Sign in again
            </Button>
          )}
        />
      ) : null}
      <ConfirmPopover
        role="alert"
        icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
        title={`Disconnect ${info.label}?`}
        description="Signs the CLI out on this machine. Connect again to sign back in."
        confirmLabel="Disconnect"
        isOpen={confirm === 'disconnect'}
        onConfirm={() => {
          onConfirmChange('none');
          onDisconnect();
        }}
        onCancel={() => onConfirmChange('none')}
        trigger={() => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onConfirmChange('disconnect')}
            className={cn('text-danger', dangerTint.hoverBg, 'hover:text-danger')}
          >
            Disconnect
          </Button>
        )}
      />
    </ConnectionTest>
  );
};
