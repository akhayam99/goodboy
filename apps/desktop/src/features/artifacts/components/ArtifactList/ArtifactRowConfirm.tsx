import { AnchoredConfirm } from '../../../../shared/components/AnchoredConfirm';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ActionControls } from '../../../actions/useActionControls';

type Props = {
  readonly controls: ActionControls;
};

const ROW_ANCHOR = 'absolute right-0 top-8 size-0';

export const ArtifactRowConfirm = ({ controls }: Props) => {
  const action = controls.confirming;
  const confirm = action?.confirm ?? null;
  const Icon = action?.icon;
  return (
    <AnchoredConfirm
      anchorClassName={ROW_ANCHOR}
      role={confirm?.role ?? 'primary'}
      icon={Icon === undefined ? null : <Icon size={ICON_SIZE.row} aria-hidden />}
      title={confirm?.title ?? ''}
      description={confirm?.description}
      confirmLabel={confirm?.confirmLabel ?? ''}
      isOpen={action !== null && confirm !== null}
      isBusy={action !== null && controls.pendingId === action.id}
      onConfirm={() => controls.confirm()}
      onCancel={controls.cancel}
    />
  );
};
