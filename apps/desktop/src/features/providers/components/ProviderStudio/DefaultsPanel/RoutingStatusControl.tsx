import { RotateCcw } from 'lucide-react';
import { Chip, Tooltip } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly isCustom: boolean;
  readonly disabled: boolean;
  readonly onReset: () => void;
  readonly idleLabel?: string | null;
  readonly resetLabel?: string;
};

export const RoutingStatusControl = ({
  label,
  isCustom,
  disabled,
  onReset,
  idleLabel = null,
  resetLabel = 'Reset to default',
}: Props) => {
  if (!isCustom && idleLabel === null) {
    return null;
  }
  const status = isCustom ? 'custom' : idleLabel;

  return (
    <div className="flex shrink-0 items-center justify-end">
      <Chip
        tone={isCustom ? 'primary' : 'neutral'}
        width="md"
        label={status}
        ariaLabel={`${label} routing status: ${status}`}
        bordered={false}
        trailing={
          isCustom ? (
            <Tooltip content={resetLabel}>
              <button
                type="button"
                onClick={onReset}
                disabled={disabled}
                aria-label={resetLabel}
                className="inline-flex items-center justify-center rounded-full text-current opacity-70 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw size={11} aria-hidden />
              </button>
            </Tooltip>
          ) : null
        }
      />
    </div>
  );
};
