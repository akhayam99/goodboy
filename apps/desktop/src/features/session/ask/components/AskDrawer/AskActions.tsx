import { useState } from 'react';
import { Button, InlineConfirm } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { AskAction } from '../../hooks/useAskActions';

type Props = {
  readonly actions: ReadonlyArray<AskAction>;
};

const ConfirmIcon = CONCEPT_ICONS.ask;

export const AskActions = ({ actions }: Props) => {
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const armed = actions.find((action) => action.key === armedKey) ?? null;
  if (actions.length === 0) {
    return null;
  }
  if (armed !== null && armed.confirm !== null) {
    return (
      <InlineConfirm
        role={armed.confirm.role}
        icon={<ConfirmIcon size={ICON_SIZE.row} aria-hidden />}
        title={armed.confirm.title}
        description={armed.confirm.description}
        confirmLabel={armed.confirm.confirmLabel}
        onConfirm={() => {
          setArmedKey(null);
          armed.run();
        }}
        onCancel={() => setArmedKey(null)}
      />
    );
  }
  return (
    <div data-testid="ask-actions" className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.key}
          variant="secondary"
          size="sm"
          onClick={() => {
            if (action.confirm !== null) {
              setArmedKey(action.key);
              return;
            }
            action.run();
          }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
};
