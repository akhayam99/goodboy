import type { SentryIssueDetail } from '../client';
import { visibleSentryTags } from '../visibleSentryTags';

type Params = {
  readonly identifier: string;
  readonly title: string;
  readonly level: string | null;
  readonly culprit: string | null;
  readonly permalink: string | null;
  readonly detail: SentryIssueDetail | null;
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const sentryIssueView = ({
  identifier,
  title,
  level,
  culprit,
  permalink,
  detail,
  isLoading,
  error,
}: Params) => {
  const breadcrumbs = detail?.breadcrumbs ?? [];

  return {
    identifier,
    title: detail?.title ?? title,
    level,
    culprit: detail?.culprit ?? culprit,
    permalink,
    tags: visibleSentryTags({ detail }),
    frames: detail?.frames ?? [],
    breadcrumbs,
    hasBreadcrumbs: breadcrumbs.length > 0 && !isLoading && error == null,
    breadcrumbsLabel: `Breadcrumbs (${breadcrumbs.length})`,
  };
};
