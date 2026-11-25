import { SelectableRow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly count: number;
  readonly isFolded: boolean;
  readonly onToggle: () => void;
};

type CountParams = {
  readonly count: number;
};

const tabsWordOf = ({ count }: CountParams): string => (count === 1 ? '1 tab' : `${count} tabs`);

export const BrowserTabGroupLabel = ({ label, count, isFolded, onToggle }: Props) => (
  <SelectableRow
    selected={false}
    ariaLabel={isFolded ? `${label}, folded, ${tabsWordOf({ count })}` : label}
    isExpanded={!isFolded}
    title={isFolded ? `Show the tabs of ${label}` : `Fold the tabs of ${label}`}
    tooltipSide="top"
    onClick={onToggle}
    className="h-6 w-auto min-w-0 max-w-44 shrink-0 items-center gap-1 bg-subtle px-2 text-control text-foreground"
  >
    <span className="min-w-0 truncate">{label}</span>
    {isFolded ? <span className="shrink-0 text-muted-foreground">{count}</span> : null}
  </SelectableRow>
);
