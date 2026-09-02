import { cn } from '@goodboy/ui';
import type { BreadcrumbCrumb } from '../../../../app/components/AppBreadcrumb/buildBreadcrumb';
import { CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS, CRUMB_LINK_CLASS } from './crumbClasses';

type PlainCrumbProps = {
  readonly crumb: BreadcrumbCrumb;
  readonly isLast: boolean;
};

export const PlainCrumb = ({ crumb, isLast }: PlainCrumbProps) => {
  const Icon = crumb.icon;
  const content = (
    <>
      {Icon == null ? null : (
        <Icon size={13} aria-hidden className="shrink-0 text-muted-foreground/70" />
      )}
      <span aria-current={isLast ? 'page' : undefined} className="min-w-0 truncate">
        {crumb.label}
      </span>
      {crumb.accessory}
    </>
  );

  return crumb.onClick != null && !isLast ? (
    <button
      type="button"
      onClick={crumb.onClick}
      className={cn(CRUMB_BUTTON_CLASS, CRUMB_LINK_CLASS)}
    >
      {content}
    </button>
  ) : (
    <span className={cn(CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS)}>{content}</span>
  );
};
