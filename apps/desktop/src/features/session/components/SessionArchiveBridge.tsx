import { useMemo } from 'react';
import { useCurrentSession } from '../../../store';
import { useShortcut } from '../../../shared/keyboard/useShortcut';
import { useActionControls } from '../../actions/useActionControls';
import type { ObjectTarget } from '../../actions/types';
import { ArmedActionPopover } from '../../../shared/components/HeaderConfirm/ArmedActionPopover';

export const SessionArchiveBridge = () => {
  const session = useCurrentSession();
  const sessionId = session?.id ?? null;
  const target = useMemo<ObjectTarget | null>(
    () => (sessionId === null ? null : { kind: 'session', sessionId }),
    [sessionId],
  );
  const controls = useActionControls({ target, scopeKey: sessionId });

  useShortcut('session.archive', () => {
    if (session === null) {
      return;
    }
    controls.trigger({
      actionId: session.archivedAt == null ? 'session.archive' : 'session.restore',
    });
  });

  const confirming = controls.confirming;
  return (
    <ArmedActionPopover
      armed={confirming === null ? null : { action: confirming, run: () => controls.confirm() }}
      onClose={controls.cancel}
      trigger={() => <span aria-hidden className="fixed bottom-4 right-4 size-0" />}
    />
  );
};
