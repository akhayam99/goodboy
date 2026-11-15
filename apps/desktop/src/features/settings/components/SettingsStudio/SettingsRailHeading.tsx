import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly caption?: string;
};

export const SettingsRailHeading = ({ label, caption }: Props) => (
  <h2 className="flex h-6 min-w-0 items-center gap-2 px-2">
    <Eyebrow label={label} className="min-w-0 truncate" />
    {caption === undefined ? null : (
      <span className="shrink-0 text-meta text-faint-foreground">{caption}</span>
    )}
  </h2>
);
