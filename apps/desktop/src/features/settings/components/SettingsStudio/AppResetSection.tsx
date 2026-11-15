import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Band, Button, cn, ConfirmPopover, ICON_SIZE, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

import { NAMES } from '../../../../shared/utils/names';
import { DANGER_ZONE } from './dangerZone';
import { SettingRow } from './SettingRow';

type WipeState = 'idle' | 'confirm' | 'wiping' | 'done';

export const AppResetSection = () => {
  const wipeLocalDatabase = useAppStore((s) => s.wipeLocalDatabase);
  const relaunchApp = useAppStore((s) => s.relaunchApp);
  const reportError = useAppStore((s) => s.reportError);
  const [wipeState, setWipeState] = useState<WipeState>('idle');

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
        help="Every workspace, session, transcript and rule. Keychain keys are untouched."
      >
        {wipeState === 'done' ? (
          <span className="flex items-center gap-3">
            <span className="text-meta text-muted-foreground">Local data deleted.</span>
            <Button variant="secondary" size="sm" onClick={() => void relaunchApp()}>
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
                onClick={() => setWipeState('confirm')}
                className={cn('text-danger', tintClasses('danger').hoverBg, 'hover:text-danger')}
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
