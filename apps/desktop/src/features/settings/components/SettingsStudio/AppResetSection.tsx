import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button, Eyebrow, FieldRow, InlineConfirm, cn, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/names';

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
      void reportError({ title: "Couldn't delete the local data", error: err });
    }
  };

  return (
    <section aria-labelledby="backup-reset" className="flex flex-col gap-3">
      <h2 id="backup-reset" className="flex items-center gap-2">
        <Eyebrow label="Reset" />
      </h2>
      {wipeState === 'confirm' || wipeState === 'wiping' ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title="Delete every workspace, session and rule?"
          description="This cannot be undone. Keychain keys stay. The app starts on a fresh schema after a restart."
          confirmLabel="Delete"
          isBusy={wipeState === 'wiping'}
          onConfirm={onWipe}
          onCancel={() => setWipeState('idle')}
          className="text-left"
        />
      ) : (
        <FieldRow
          label={NAMES.deleteAllData}
          help="Every workspace, session, transcript and rule. Keychain keys are untouched."
        >
          {wipeState === 'done' ? (
            <span className="flex items-center gap-3">
              <span className="text-label text-muted-foreground">Local data deleted.</span>
              <Button variant="secondary" size="sm" onClick={() => void relaunchApp()}>
                <RotateCcw size={ICON_SIZE.row} aria-hidden />
                Restart now
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWipeState('confirm')}
              className={cn('text-danger', tintClasses('danger').hoverBg, 'hover:text-danger')}
            >
              {NAMES.deleteAllData}
            </Button>
          )}
        </FieldRow>
      )}
    </section>
  );
};
