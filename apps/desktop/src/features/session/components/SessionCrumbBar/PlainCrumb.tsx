import { cn } from '@goodboy/ui';
import type { BreadcrumbCrumb } from '../../../../app/components/AppBreadcrumb/buildBreadcrumb';
import { CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS, CRUMB_LINK_CLASS } from './crumbClasses';

type PlainCrumbProps = {
  readonly crumb: BreadcrumbCrumb;
  readonly isLast: boolean;
};

export const PlainCrumb = ({ crumb, isLast }: PlainCrumbProps) =>
  crumb.onClick != null && !isLast ? (
    <button
      type="button"
      onClick={crumb.onClick}
      className={cn(CRUMB_BUTTON_CLASS, CRUMB_LINK_CLASS)}
    >
      {crumb.label}
    </button>
  ) : (
    <span
      aria-current={isLast ? 'page' : undefined}
      className={cn(CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS)}
    >
      {crumb.label}
    </span>
  );
