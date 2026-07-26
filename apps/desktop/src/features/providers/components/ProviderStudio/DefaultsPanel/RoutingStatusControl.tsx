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
    <div className="flex shrink-0 items-center gap-1">
      <Chip
        tone={isCustom ? 'primary' : 'neutral'}
        label={status}
        ariaLabel={`${label} routing status: ${status}`}
        bordered={false}
        className={isCustom ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}
      />
      {isCustom ? (
        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          aria-label="Reset to default"
          title="Reset to default"
          className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw size={12} aria-hidden />
        </button>
      ) : null}
    </div>
  );
};
