import { InlineConfirm } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ActionConfirm } from '../../../actions/types';
import type { PaletteEntry } from '../../types';

type Props = {
  readonly entry: PaletteEntry;
  readonly confirm: ActionConfirm;
  readonly subject: string | null;
  readonly altLabel: string | null;
  readonly onConfirm: () => void;
  readonly onAlt: () => void;
  readonly onCancel: () => void;
};

export const VerbConfirm = ({
  entry,
  confirm,
  subject,
  altLabel,
  onConfirm,
  onAlt,
  onCancel,
}: Props) => {
  const Icon = entry.icon;
  return (
    <div className="p-3">
      <InlineConfirm
        role={confirm.role}
        icon={<Icon size={ICON_SIZE.row} aria-hidden />}
        title={confirm.title}
        description={confirm.description}
        confirmLabel={confirm.confirmLabel}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...(altLabel !== null && { altAction: { label: altLabel, onClick: onAlt } })}
      >
        {subject !== null && (
          <p className="truncate rounded-md border border-border-soft bg-subtle px-2 py-1 text-code text-foreground">
            {subject}
          </p>
        )}
      </InlineConfirm>
    </div>
  );
};
