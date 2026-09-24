import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button, InlineConfirm, Notice, cn, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type WipeState = 'idle' | 'confirm' | 'wiping' | 'done';

export const AppDangerSection = () => {
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
      void reportError({ title: "Couldn't wipe the local database", error: err });
    }
  };

  return (
    <Notice
      tone="danger"
      placement="inline"
      title="Wipe local database"
      body="Every workspace, session, transcript, and rule. Keychain keys are untouched. Fresh schema on next boot."
      actions={
        wipeState === 'done' ? (
          <span className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Local data wiped.</span>
            <Button variant="secondary" size="sm" onClick={() => void relaunchApp()}>
              <RotateCcw size={ICON_SIZE.row} aria-hidden />
              Restart now
            </Button>
          </span>
        ) : wipeState === 'idle' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWipeState('confirm')}
            className={cn('text-danger', tintClasses('danger').hoverBg, 'hover:text-danger')}
          >
            Wipe
          </Button>
        ) : null
      }
    >
      {(wipeState === 'confirm' || wipeState === 'wiping') && (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title="Wipe every workspace, session and rule?"
          description="This cannot be undone. Keychain keys stay. The app starts on a fresh schema after a restart."
          confirmLabel="Wipe"
          isBusy={wipeState === 'wiping'}
          onConfirm={onWipe}
          onCancel={() => setWipeState('idle')}
          className="text-left"
        />
      )}
    </Notice>
  );
};
