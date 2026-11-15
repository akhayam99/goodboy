import { BAND_ROW_CLASS, cn, ICON_SIZE, tintClasses } from '@goodboy/ui';
import type { PermissionRow } from './permissionRows';

type Props = {
  readonly rows: ReadonlyArray<PermissionRow>;
};

export const PermissionsGroup = ({ rows }: Props) => (
  <ul className="flex flex-col">
    {rows.map((row) => {
      const tint = tintClasses(row.verdict.tone);
      const Icon = row.verdict.icon;
      return (
        <li key={row.key} className={cn(BAND_ROW_CLASS, 'gap-3 text-meta')}>
          <span className="w-28 shrink-0 truncate text-foreground">{row.label}</span>
          <span className="flex w-36 shrink-0 items-center gap-1 text-muted-foreground">
            <Icon
              size={ICON_SIZE.row}
              aria-hidden
              className={row.verdict.tone === 'neutral' ? undefined : tint.text}
            />
            {row.verdict.word}
          </span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.detail}</span>
        </li>
      );
    })}
  </ul>
);
