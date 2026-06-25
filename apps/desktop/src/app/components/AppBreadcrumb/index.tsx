import { ChevronRight } from 'lucide-react';
import type { BreadcrumbCrumb } from './buildBreadcrumb';

export const AppBreadcrumb = ({ crumbs }: { crumbs: BreadcrumbCrumb[] }) => {
  return (
    <nav className="flex min-w-0 items-center gap-1" aria-label="breadcrumb">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={crumb.id} className="flex min-w-0 items-center gap-1">
            {index > 0 && (
              <ChevronRight size={11} aria-hidden className="shrink-0 text-muted-foreground/40" />
            )}
            {isLast ? (
              <span
                className="min-w-0 truncate text-2xs font-semibold text-foreground/90"
                title={crumb.label}
                aria-current="page"
              >
                {crumb.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={crumb.onClick}
                className="min-w-0 truncate text-2xs text-muted-foreground transition-colors hover:text-foreground"
                title={crumb.label}
              >
                {crumb.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
};
