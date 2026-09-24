import { Button, ClampedProse, Eyebrow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly value: string;
  readonly action: string;
  readonly isProse: boolean;
  readonly onUse: () => void;
};

export const AdoptionRow = ({ label, value, action, isProse, onUse }: Props) =>
  isProse ? (
    <div className="flex items-start gap-2">
      <Eyebrow label={label} className="w-10 shrink-0 pt-1" />
      <div className="min-w-0 flex-1">
        <ClampedProse text={value} lines={4} className="text-xs leading-relaxed text-foreground" />
      </div>
      <Button variant="secondary" size="sm" onClick={onUse}>
        {action}
      </Button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Eyebrow label={label} className="w-10 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs text-foreground">{value}</span>
      <Button variant="secondary" size="sm" onClick={onUse}>
        {action}
      </Button>
    </div>
  );
