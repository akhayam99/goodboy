import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ObjectOverflowMenu } from '../ObjectOverflowMenu';
import type { ActionControls } from '../../useActionControls';
import { ActionButton } from './ActionButton';

type Props = {
  readonly controls: ActionControls;
  readonly menuLabel: string;
};

export const ActionButtons = ({ controls, menuLabel }: Props) => {
  if (controls.target === null) {
    return null;
  }
  const secondaries = controls.inSlot({ slot: 'secondary' });
  const primary = controls.inSlot({ slot: 'primary' })[0] ?? null;
  const ordered = [
    ...secondaries.filter((action) => action.group !== 'open'),
    ...secondaries.filter((action) => action.group === 'open'),
  ];
  return (
    <div className="flex shrink-0 items-center gap-2">
      {ordered.map((action) => (
        <ActionButton key={action.id} action={action} controls={controls} variant="secondary" />
      ))}
      {primary !== null && <ActionButton action={primary} controls={controls} variant="primary" />}
      <ObjectOverflowMenu
        target={controls.target}
        label={menuLabel}
        trigger={<CONCEPT_ICONS.more size={ICON_SIZE.row} aria-hidden />}
      />
    </div>
  );
};
