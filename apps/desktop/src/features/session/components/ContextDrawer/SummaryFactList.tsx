import { SummaryLine } from './SummaryLine';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly items: ReadonlyArray<string>;
};

export const SummaryFactList = ({ id, label, items }: Props) => (
  <ul id={id} aria-label={label} className="flex min-w-0 flex-col gap-2">
    {items.map((item, index) => (
      <li key={`${index}-${item}`} className="flex min-w-0 items-start gap-3">
        <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center">
          <span className="size-1 rounded-full bg-faint-foreground" />
        </span>
        <SummaryLine item={item} className="text-body text-foreground" />
      </li>
    ))}
  </ul>
);
