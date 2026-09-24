import { Eyebrow } from '@goodboy/ui';
type Props = {
  readonly label: string;
  readonly children: string;
};

export const BuiltFromRow = ({ label, children }: Props) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <Eyebrow label={label} />
    <span className="min-w-0 whitespace-pre-wrap break-words text-xs text-foreground">
      {children}
    </span>
  </div>
);
