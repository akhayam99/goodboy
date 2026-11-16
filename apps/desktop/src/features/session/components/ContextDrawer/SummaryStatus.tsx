import { useMemo } from 'react';
import { CircleCheck, CircleDashed, TriangleAlert, type LucideIcon } from 'lucide-react';
import { ICON_SIZE, cn, tintClasses, type Tone } from '@goodboy/ui';
import { parseSummaryDocument } from '@goodboy/core/context';
import { summaryStatusOf, type SummaryStatusTone } from './summaryStatusOf';
import { summaryStatusWordOf } from './summaryStatusWordOf';
import { SummaryLine } from './SummaryLine';

const GLYPH: Readonly<
  Record<SummaryStatusTone, { readonly icon: LucideIcon; readonly tone: Tone }>
> = {
  blocked: { icon: TriangleAlert, tone: 'warning' },
  working: { icon: CircleDashed, tone: 'info' },
  done: { icon: CircleCheck, tone: 'success' },
};

const ROW = 'flex min-w-0 items-start gap-3 px-3 py-1';

const MARK = 'flex h-5 w-8 shrink-0 items-center justify-center';

type Props = {
  readonly value: string;
};

export const SummaryStatus = ({ value }: Props) => {
  const status = useMemo(
    () => summaryStatusOf({ document: parseSummaryDocument({ text: value }) }),
    [value],
  );
  if (status === null) {
    return null;
  }
  const glyph = GLYPH[status.tone];
  const Glyph = glyph.icon;
  return (
    <section
      aria-label="State"
      data-context-status={status.tone}
      className="flex min-w-0 flex-col gap-1 rounded-lg border border-border-soft bg-subtle p-1"
    >
      <div className="flex min-w-0 items-start gap-3 px-3 py-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fill">
          <Glyph
            size={ICON_SIZE.notice}
            aria-hidden
            className={cn('shrink-0', tintClasses(glyph.tone).icon)}
          />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-heading text-foreground">{summaryStatusWordOf({ status })}</span>
          {status.line === null ? null : (
            <SummaryLine item={status.line} className="text-body text-muted-foreground" />
          )}
        </span>
      </div>
      {status.blockers.length === 0 ? null : (
        <ul aria-label="Blockers" className="flex min-w-0 flex-col">
          {status.blockers.map((blocker, index) => (
            <li key={`${index}-${blocker}`} data-summary-blocker="" className={ROW}>
              <span className={MARK}>
                <TriangleAlert
                  size={ICON_SIZE.control}
                  aria-hidden
                  className={tintClasses('warning').icon}
                />
              </span>
              <span className="sr-only">Blocker: </span>
              <SummaryLine item={blocker} className="text-body text-foreground" />
            </li>
          ))}
        </ul>
      )}
      {status.facts.length === 0 ? null : (
        <ul aria-label="More on the state" className="flex min-w-0 flex-col">
          {status.facts.map((fact, index) => (
            <li key={`${index}-${fact}`} className={ROW}>
              <span aria-hidden className={MARK}>
                <span className="size-1 rounded-full bg-faint-foreground" />
              </span>
              <SummaryLine item={fact} className="text-body text-muted-foreground" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
