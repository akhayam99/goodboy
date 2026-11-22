import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useState } from 'react';
import { RotateCcw, Trash2 } from '@goodboy/ui/icons';
import { Band, Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';

import { NAMES } from '../../../../shared/utils/names';
import { actionIntentOf } from '../../../actions/actionIntentOf';
import { DANGER_ZONE } from './dangerZone';
import { SettingRow } from './SettingRow';

type WipeState = 'idle' | 'confirm' | 'wiping' | 'done';

const RELAUNCH_KEY = 'relaunch';

export const AppResetSection = () => {
  const wipeLocalDatabase = useAppStore((s) => s.wipeLocalDatabase);
  const relaunchApp = useAppStore((s) => s.relaunchApp);
  const reportError = useAppStore((s) => s.reportError);
  const [wipeState, setWipeState] = useState<WipeState>('idle');
  const { pendingKeys, run } = usePendingAction();

  const onWipe = async () => {
    setWipeState('wiping');
    try {
      await wipeLocalDatabase();
      setWipeState('done');
    } catch (err) {
      setWipeState('confirm');
      void reportError({
        recovery: CHECK_STATE,
        title: "Couldn't delete the local data",
        error: err,
      });
    }
  };

  return (
    <Band inset="content" label={DANGER_ZONE} ariaLabel={DANGER_ZONE} headingLevel={2}>
      <SettingRow
        label={NAMES.deleteAllData}
        rowKey="delete-all-data"
        help="Every workspace, session, transcript and rule. Keychain keys stay."
      >
        {wipeState === 'done' ? (
          <span className="flex items-center gap-3">
            <span className="text-meta text-muted-foreground">Local data deleted.</span>
            <Button
              variant="secondary"
              size="sm"
              isBusy={pendingKeys.has(RELAUNCH_KEY)}
              onClick={() =>
                void run({
                  key: RELAUNCH_KEY,
                  failureTitle: "Couldn't restart Goodboy",
                  task: relaunchApp,
                })
              }
            >
              <RotateCcw size={ICON_SIZE.row} aria-hidden />
              Restart now
            </Button>
          </span>
        ) : (
          <ConfirmPopover
            role="danger"
            icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
            title="Delete every workspace, session and rule?"
            description="This can't be undone. Keychain keys stay. The app starts on a fresh schema after a restart."
            confirmLabel="Delete"
            isBusy={wipeState === 'wiping'}
            isOpen={wipeState === 'confirm' || wipeState === 'wiping'}
            onConfirm={onWipe}
            onCancel={() => setWipeState('idle')}
            trigger={() => (
              <Button
                variant="ghost"
                size="sm"
                intent={actionIntentOf({ verb: NAMES.deleteAllData })}
                onClick={() => setWipeState('confirm')}
              >
                {NAMES.deleteAllData}
              </Button>
            )}
          />
        )}
      </SettingRow>
    </Band>
  );
};
