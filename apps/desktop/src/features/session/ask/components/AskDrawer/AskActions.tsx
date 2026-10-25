import { Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import type { AskAction } from '../../hooks/useAskActions';

type Props = {
  readonly actions: ReadonlyArray<AskAction>;
};

const ConfirmIcon = CONCEPT_ICONS.ask;

export const AskActions = ({ actions }: Props) => {
  if (actions.length === 0) {
    return null;
  }
  return (
    <div data-testid="ask-actions" className="flex flex-wrap gap-2">
      {actions.map((action) =>
        action.confirm === null ? (
          <Button key={action.key} variant="secondary" size="sm" onClick={action.run}>
            {action.label}
          </Button>
        ) : (
          <ConfirmPopover
            key={action.key}
            role={action.confirm.role}
            icon={<ConfirmIcon size={ICON_SIZE.row} aria-hidden />}
            title={action.confirm.title}
            description={action.confirm.description}
            confirmLabel={action.confirm.confirmLabel}
            onConfirm={action.run}
            trigger={({ arm }) => (
              <Button variant="secondary" size="sm" onClick={arm}>
                {action.label}
              </Button>
            )}
          />
        ),
      )}
    </div>
  );
};
