import { RotateCcw } from 'lucide-react';
import { Chip } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly isCustom: boolean;
  readonly disabled: boolean;
  readonly onReset: () => void;
};

export const RoutingStatusControl = ({ label, isCustom, disabled, onReset }: Props) => {
  const status = isCustom ? 'custom' : 'default';

  return (
    <div className="flex w-24 shrink-0 items-center justify-end">
      <Chip
        tone={isCustom ? 'primary' : 'neutral'}
        label={status.toUpperCase()}
        ariaLabel={`${label} routing status: ${status}`}
        bordered={false}
        trailing={
          isCustom ? (
            <button
              type="button"
              onClick={onReset}
              disabled={disabled}
              aria-label="Reset to default"
              className="inline-flex items-center justify-center rounded-full text-current opacity-70 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={11} aria-hidden />
            </button>
          ) : null
        }
      />
    </div>
  );
};
