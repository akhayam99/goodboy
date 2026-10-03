import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox, Chip, EmptyLine, IconButton } from '@goodboy/ui';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { PagePlan, PlanItem } from '../../workspaceSettings/plan';
import type { FlowMode } from './WorkspaceSettingsFlow';
import { workspacePageEntry } from './workspacePages';

const STAYS = 'Stays: projects, folders, accounts, permission history.';

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

const summaryOf = ({ items }: { readonly items: ReadonlyArray<PlanItem> }): string => {
  const shown = items
    .slice(0, 2)
    .map((item) => `${lowerFirst(item.label)} ${item.from} → ${item.to}`);
  return items.length > 2 ? [...shown, `${items.length - 2} more`].join(', ') : shown.join(', ');
};

type Props = {
  readonly mode: FlowMode;
  readonly plan: ReadonlyArray<PagePlan>;
  readonly sourceName: string | null;
  readonly count: number;
  readonly pageCount: number;
  readonly skipped: ReadonlySet<string>;
  readonly expanded: ReadonlySet<string>;
  readonly onToggleSkip: (page: string) => void;
  readonly onToggleOpen: (page: string) => void;
};

export const FlowPlanPreview = ({
  mode,
  plan,
  sourceName,
  count,
  pageCount,
  skipped,
  expanded,
  onToggleSkip,
  onToggleOpen,
}: Props) => {
  if (plan.length === 0) {
    return (
      <EmptyLine>
        {mode === 'restore'
          ? 'Everything here is already the default. Nothing to restore.'
          : `${sourceName ?? 'That workspace'} has nothing different to copy here.`}
      </EmptyLine>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p aria-live="polite" className="text-label text-muted-foreground">
        {mode === 'copy'
          ? `Will change ${pluralize(count, 'setting')} on ${pluralize(pageCount, 'page')}. ${STAYS}`
          : `Goes back to the default: ${pluralize(count, 'setting')} on ${pluralize(pageCount, 'page')}.`}
      </p>
      <ul className="flex flex-col gap-1">
        {plan.map((page) => {
          const label = workspacePageEntry({ page: page.page }).label;
          const isOpen = expanded.has(page.page);
          const Chevron = isOpen ? ChevronDown : ChevronRight;
          return (
            <li key={page.page} className="flex flex-col gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <Checkbox
                  checked={!skipped.has(page.page)}
                  onChange={() => onToggleSkip(page.page)}
                  ariaLabel={`Include ${label}`}
                />
                <span className="shrink-0 text-row text-foreground">{label}</span>
                <Chip tone="neutral" size="sm" label={String(page.items.length)} />
                <span className="min-w-0 flex-1 truncate text-secondary text-muted-foreground">
                  {summaryOf({ items: page.items })}
                </span>
                <IconButton
                  icon={Chevron}
                  label={isOpen ? `Hide ${label} changes` : `Show ${label} changes`}
                  variant="ghost"
                  onClick={() => onToggleOpen(page.page)}
                />
              </div>
              {isOpen ? (
                <dl className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] gap-x-4 gap-y-1 pl-7">
                  {page.items.map((item) => (
                    <div key={item.field} className="contents">
                      <dt className="truncate text-secondary text-muted-foreground">
                        {item.label}
                      </dt>
                      <dd className="min-w-0 truncate text-secondary">
                        <span className="text-faint-foreground">{item.from}</span>
                        <span aria-hidden className="px-1.5 text-faint-foreground">
                          →
                        </span>
                        <span className="sr-only">to</span>
                        <span className="text-foreground">{item.to}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
