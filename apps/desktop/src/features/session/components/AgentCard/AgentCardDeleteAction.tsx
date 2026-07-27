import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { AgentCardAction } from './AgentCardAction';

type Props = {
  readonly label: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly reveal?: boolean;
  readonly resetToken?: unknown;
  readonly onDelete: () => void;
};

export const AgentCardDeleteAction = ({
  label,
  confirmLabel,
  cancelLabel,
  reveal = true,
  resetToken,
  onDelete,
}: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    setIsConfirming(false);
  }, [resetToken]);

  return (
    <span className="flex w-[3.25rem] shrink-0 items-center justify-end gap-1">
      {isConfirming && (
        <AgentCardAction icon={X} label={cancelLabel} onClick={() => setIsConfirming(false)} />
      )}
      <AgentCardAction
        icon={Trash2}
        label={isConfirming ? confirmLabel : label}
        tone="danger"
        active={isConfirming}
        reveal={reveal && !isConfirming}
        onClick={() => {
          if (!isConfirming) {
            setIsConfirming(true);
            return;
          }
          setIsConfirming(false);
          onDelete();
        }}
      />
    </span>
  );
};
