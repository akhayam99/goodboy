import { X } from 'lucide-react';
import { IconButton, cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly items: ReadonlyArray<string>;
  readonly emptyLabel: string;
  readonly isCode?: boolean;
  readonly removeLabel: (item: string) => string;
  readonly onRemove: (item: string) => void;
};

export const BriefItems = ({
  label,
  items,
  emptyLabel,
  isCode = false,
  removeLabel,
  onRemove,
}: Props) => (
  <div className="flex flex-col gap-2">
    <span className="text-label text-muted-foreground">{label}</span>
    {items.length === 0 ? (
      <p className="text-meta text-faint-foreground">{emptyLabel}</p>
    ) : (
      <ul aria-label={label} className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li
            key={item}
            className="group flex min-w-0 items-start gap-2 rounded-md py-0.5 pl-2 pr-0.5 hover:bg-hover"
          >
            <span
              className={cn(
                'min-w-0 flex-1 text-foreground',
                isCode ? 'truncate text-code' : 'text-label',
              )}
            >
              {item}
            </span>
            <IconButton
              size="xs"
              icon={X}
              label={removeLabel(item)}
              tooltip="Remove"
              variant="ghost"
              iconSize={11}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => onRemove(item)}
            />
          </li>
        ))}
      </ul>
    )}
  </div>
);
