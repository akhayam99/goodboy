import { Eyebrow, Kbd } from '@goodboy/ui';
import type { PrefixMeta } from '../../../../quick-actions/grammar';

type PrefixRowProps = {
  readonly title: string;
  readonly prefixes: ReadonlyArray<PrefixMeta>;
};

export const PrefixRow = ({ title, prefixes }: PrefixRowProps) => (
  <div className="flex flex-col gap-2">
    <Eyebrow label={title} muted />
    <ul className="flex flex-wrap gap-2">
      {prefixes.map((prefix) => (
        <li
          key={prefix.symbol}
          className="flex items-center gap-2 rounded-md border border-border-soft px-2 py-1 text-label text-foreground"
        >
          <Kbd look="cap">{prefix.symbol}</Kbd>
          <span className="capitalize">{prefix.noun}</span>
        </li>
      ))}
    </ul>
  </div>
);
