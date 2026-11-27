import { Button, Eyebrow, StatusMark, TruncatedText } from '@goodboy/ui';
import type { ChipRow } from '../callChipTypes';

type OpenParams = {
  readonly rowKey: string;
};

type Props = {
  readonly heading: string | null;
  readonly rows: ReadonlyArray<ChipRow>;
  readonly onOpen: (params: OpenParams) => void;
};

export const CallChipRows = ({ heading, rows, onOpen }: Props) => (
  <section
    aria-label={heading ?? 'What happened'}
    className="flex min-w-0 flex-col gap-1 rounded-lg bg-subtle p-2"
  >
    {heading === null ? null : <Eyebrow label={heading} />}
    {rows.length === 0 ? null : (
      <ul className="flex min-w-0 flex-col">
        {rows.map((row) => (
          <li key={row.key} className="flex min-h-7 min-w-0 items-center gap-2">
            <span className="inline-flex shrink-0 text-faint-foreground">
              <StatusMark mark={row.mark} />
            </span>
            <TruncatedText className="min-w-0 flex-1 text-meta text-foreground">
              {row.text}
            </TruncatedText>
            {row.canOpen ? (
              <Button
                variant="ghost"
                size="xs"
                aria-label={`Open ${row.text}`}
                onClick={() => onOpen({ rowKey: row.key })}
              >
                Open
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    )}
  </section>
);
