import { AnchoredPopover, Tooltip, cn, useDropdown } from '@goodboy/ui';
import type { BreadcrumbCrumb } from '../../breadcrumbCrumb';
import { CRUMB_BUTTON_CLASS, CRUMB_LINK_CLASS } from './crumbClasses';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly crumbs: ReadonlyArray<BreadcrumbCrumb>;
  readonly className?: string;
};

export const CollapsedCrumbs = ({ crumbs, className }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    expectedHeight: 32 * crumbs.length + 8,
    expectedWidth: 224,
    width: 'w-56 max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <span className={cn('flex min-w-0 items-center', className)}>
      <AnchoredPopover
        dropdown={dropdown}
        role="menu"
        ariaLabel="Hidden pages"
        className="bg-subtle"
        anchorClassName="flex min-w-0 items-center"
        trigger={
          <Tooltip content="Show hidden pages" anchorClassName="shrink-0">
            <button
              type="button"
              onClick={toggle}
              aria-label="Show hidden pages"
              aria-haspopup="menu"
              aria-expanded={open}
              className={cn(CRUMB_BUTTON_CLASS, CRUMB_LINK_CLASS)}
            >
              <CONCEPT_ICONS.more size={ICON_SIZE.row} aria-hidden />
            </button>
          </Tooltip>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1">
          {crumbs.map((crumb) => {
            const Icon = crumb.icon;
            return (
              <button
                key={crumb.id}
                type="button"
                role="menuitem"
                disabled={crumb.onClick == null}
                onClick={() => {
                  close();
                  crumb.onClick?.();
                }}
                className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:hover:bg-transparent"
              >
                {Icon == null ? null : (
                  <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{crumb.label}</span>
              </button>
            );
          })}
        </div>
      </AnchoredPopover>
    </span>
  );
};
