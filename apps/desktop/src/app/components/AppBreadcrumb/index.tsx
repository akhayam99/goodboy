import { ChevronRight } from 'lucide-react';
import type { BreadcrumbCrumb } from './buildBreadcrumb';

type Props = {
  readonly crumbs: BreadcrumbCrumb[];
};

export const AppBreadcrumb = ({ crumbs }: Props) => {
  return (
    <nav className="flex min-w-0 items-center gap-2" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const Icon = crumb.icon;
        return (
          <span key={crumb.id} className="flex min-w-0 items-center gap-2">
            {index > 0 && (
              <ChevronRight size={11} aria-hidden className="shrink-0 text-muted-foreground/40" />
            )}
            {isLast ? (
              <span
                className="inline-flex min-w-0 items-center gap-2 text-2xs font-medium text-foreground"
                title={crumb.label}
                aria-current="page"
              >
                {Icon == null ? null : (
                  <Icon size={12} aria-hidden className="shrink-0 text-muted-foreground/70" />
                )}
                <span className="min-w-0 truncate">{crumb.label}</span>
                {crumb.accessory}
              </span>
            ) : (
              <button
                type="button"
                onClick={crumb.onClick}
                className="inline-flex min-w-0 items-center gap-2 text-2xs text-muted-foreground transition-colors hover:text-foreground"
                title={crumb.label}
              >
                {Icon == null ? null : (
                  <Icon size={12} aria-hidden className="shrink-0 text-muted-foreground/70" />
                )}
                <span className="min-w-0 truncate">{crumb.label}</span>
                {crumb.accessory}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
};
