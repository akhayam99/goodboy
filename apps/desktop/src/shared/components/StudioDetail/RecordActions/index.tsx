import type { ReactNode } from 'react';
import { Button, cn, ConfirmPopover, ICON_SIZE, OptionalTooltip } from '@goodboy/ui';

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

  return (
    <>
      {hasRow ? (
        <div data-slot="record-actions" className="flex flex-wrap items-center gap-2">
          {primary}
          {secondary.map((verb) => {
            const Icon = verb.icon;
            const isBlocked = verb.blockedReason != null;
            const button = (
              <OptionalTooltip content={verb.blockedReason}>
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
              </OptionalTooltip>
            );
            if (verb.confirm === null || verb.confirm === undefined) {
              return (
                <span key={verb.key} className="contents">
                  {button}
                </span>
              );
            }
            return (
              <ConfirmPopover
                key={verb.key}
                role="danger"
                icon={<Icon size={ICON_SIZE.row} aria-hidden />}
                title={verb.confirm.title}
                description={verb.confirm.description}
                confirmLabel={verb.confirm.confirmLabel}
                isOpen={armed?.key === verb.key}
                isBusy={verb.isBusy}
                isConfirmDisabled={isBlocked}
                onConfirm={async () => {
                  await verb.onRun();
                  onDisarm();
                }}
                onCancel={onDisarm}
                trigger={() => button}
              />
            );
          })}
        </div>
      ) : null}
    </>
  );
};
