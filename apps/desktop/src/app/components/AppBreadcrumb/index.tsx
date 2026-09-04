import { ChevronRight } from 'lucide-react';
import type { BreadcrumbCrumb } from './buildBreadcrumb';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { InlineMarkdown } from '../../../shared/components/InlineMarkdown';
import { stripInlineMarkdown } from '../../../shared/components/InlineMarkdown/stripInlineMarkdown';

type Props = {
  readonly crumbs: BreadcrumbCrumb[];
};

export const AppBreadcrumb = ({ crumbs }: Props) => {
  return (
    <nav className="flex min-w-0 items-center gap-2" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const Icon = crumb.icon;
        const plainLabel = stripInlineMarkdown({ text: crumb.label });
        return (
          <span key={crumb.id} className="flex min-w-0 items-center gap-2">
            {index > 0 && (
              <ChevronRight size={11} aria-hidden className="shrink-0 text-muted-foreground/40" />
            )}
            {isLast ? (
              <span
                className="inline-flex min-w-0 items-center gap-2 text-2xs font-medium text-foreground"
                title={plainLabel}
                aria-current="page"
              >
                {Icon == null ? null : (
                  <Icon
                    size={ICON_SIZE.row}
                    aria-hidden
                    className="shrink-0 text-muted-foreground/70"
                  />
                )}
                <InlineMarkdown text={crumb.label} className="min-w-0 truncate" />
                {crumb.accessory}
              </span>
            ) : (
              <button
                type="button"
                onClick={crumb.onClick}
                className="inline-flex min-w-0 items-center gap-2 text-2xs text-muted-foreground transition-colors hover:text-foreground"
                title={plainLabel}
              >
                {Icon == null ? null : (
                  <Icon
                    size={ICON_SIZE.row}
                    aria-hidden
                    className="shrink-0 text-muted-foreground/70"
                  />
                )}
                <InlineMarkdown text={crumb.label} className="min-w-0 truncate" />
                {crumb.accessory}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
};
