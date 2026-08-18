import type { IntegrationCredential } from '@goodboy/types';
import { IconButton } from '@goodboy/ui';
import { Check, Trash2 } from 'lucide-react';

type Props = {
  readonly credential: IntegrationCredential;
  readonly usedBy: number;
  readonly isSelected: boolean;
  readonly isDisabled: boolean;
  readonly onSelect: () => void;
  readonly onForget: () => void;
};

const usageLabel = ({ usedBy }: { readonly usedBy: number }): string => {
  if (usedBy === 0) {
    return 'Not used by any project';
  }
  if (usedBy === 1) {
    return 'Used by 1 project';
  }
  return `Used by ${usedBy} projects`;
};

export const CredentialRow = ({
  credential,
  usedBy,
  isSelected,
  isDisabled,
  onSelect,
  onForget,
}: Props) => {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border-soft bg-subtle/40 px-3 py-2">
      <button
        type="button"
        onClick={onSelect}
        disabled={isDisabled}
        aria-pressed={isSelected}
        className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-50"
      >
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border-soft text-accent">
          {isSelected ? <Check size={10} aria-hidden /> : null}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-xs font-semibold text-foreground">{credential.label}</span>
          <span className="truncate font-mono text-2xs text-muted-foreground">
            {credential.account === '' ? usageLabel({ usedBy }) : credential.account}
          </span>
        </span>
      </button>
      <span className="shrink-0 text-2xs text-muted-foreground">{usageLabel({ usedBy })}</span>
      <IconButton
        icon={Trash2}
        label={`Forget ${credential.label}`}
        disabled={isDisabled}
        title={
          usedBy > 0
            ? `${usageLabel({ usedBy })}. Disconnect it there before removing the key.`
            : 'Remove this key from the keychain'
        }
        onClick={onForget}
      />
    </div>
  );
};
