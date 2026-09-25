import type { ReactNode } from 'react';
import { Button, InlineConfirm, Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../conceptIcons';
import { runRecordVerb } from './runRecordVerb';
import type { RecordSecondaryVerbs, RecordVerb } from './types';

type Props = {
  readonly primary: ReactNode;
  readonly secondary: RecordSecondaryVerbs;
  readonly armed: RecordVerb | null;
  readonly onArm: (key: string) => void;
  readonly onDisarm: () => void;
};

export const RecordActions = ({ primary, secondary, armed, onArm, onDisarm }: Props) => {
  const hasRow = primary != null || secondary.length > 0;
  const confirm = armed?.confirm ?? null;

  return (
    <>
      {hasRow ? (
        <div data-slot="record-actions" className="flex flex-wrap items-center gap-1.5">
          {primary}
          {secondary.map((verb) => {
            const Icon = verb.icon;
            const isBlocked = verb.blockedReason != null;
            return (
              <Tooltip key={verb.key} content={verb.blockedReason ?? verb.label}>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-disabled={isBlocked}
                  disabled={verb.isBusy}
                  isBusy={verb.isBusy}
                  onClick={() => runRecordVerb({ verb, onArm })}
                  className={cn(isBlocked && 'opacity-50')}
                >
                  <Icon size={ICON_SIZE.row} aria-hidden />
                  {verb.label}
                </Button>
              </Tooltip>
            );
          })}
        </div>
      ) : null}
      {armed != null && confirm != null ? (
        <InlineConfirm
          role="danger"
          icon={<armed.icon size={ICON_SIZE.row} aria-hidden />}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={armed.isBusy ? `${armed.label}…` : confirm.confirmLabel}
          isBusy={armed.isBusy}
          isConfirmDisabled={armed.blockedReason != null}
          onConfirm={async () => {
            await armed.onRun();
            onDisarm();
          }}
          onCancel={onDisarm}
        />
      ) : null}
    </>
  );
};
