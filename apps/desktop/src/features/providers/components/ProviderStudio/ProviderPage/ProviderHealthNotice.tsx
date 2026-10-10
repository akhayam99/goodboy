import { Button, Notice } from '@goodboy/ui';
import type { ProviderDisplayInfo } from '../../../providers';
import { useNow } from '../../../../../shared/hooks/useNow';
import { useProviderHealth } from '../../../hooks/useProviderHealth';
import {
  breakerBody,
  breakerTitle,
  cannotCheckBody,
  cannotCheckTitle,
} from '../../../providerHealthCopy';

const CLOCK_MS = 60_000;

type Props = {
  readonly info: ProviderDisplayInfo;
  readonly isChecking: boolean;
  readonly onCheckAgain: () => void;
  readonly onSignIn?: () => void;
};

export const ProviderHealthNotice = ({ info, isChecking, onCheckAgain, onSignIn }: Props) => {
  const health = useProviderHealth({ providerId: info.id });
  const nowMs = useNow(CLOCK_MS);
  if (health.isBreakerOpen) {
    return (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title={breakerTitle({ providerId: info.id, health })}
        body={breakerBody({ providerId: info.id })}
        detail={health.lastRefusal}
        actions={
          onSignIn === undefined ? undefined : (
            <Button size="sm" variant="secondary" onClick={onSignIn}>
              Sign in again
            </Button>
          )
        }
      />
    );
  }
  if (health.standing !== 'cannot_check') {
    return null;
  }
  return (
    <Notice
      tone="info"
      placement="inline"
      role="status"
      title={cannotCheckTitle({ providerId: info.id })}
      body={cannotCheckBody({ health, nowMs })}
      actions={
        <Button size="sm" variant="ghost" disabled={isChecking} onClick={onCheckAgain}>
          Check again
        </Button>
      }
    />
  );
};
