import type { SentryIssueDetail } from '../client';
import { visibleSentryTags } from '../visibleSentryTags';

type Params = {
  readonly identifier: string;
  readonly title: string;
  readonly level: string | null;
  readonly culprit: string | null;
  readonly status: string | null;
  readonly permalink: string | null;
  readonly count?: string | null;
  readonly userCount?: number | null;
  readonly firstSeen?: string | null;
  readonly lastSeen?: string | null;
  readonly detail: SentryIssueDetail | null;
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const sentryIssueView = ({
  identifier,
  title,
  level,
  culprit,
  status,
  permalink,
  count = null,
  userCount = null,
  firstSeen = null,
  lastSeen = null,
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
    status,
    permalink,
    count,
    userCount,
    firstSeen,
    lastSeen,
    tags: visibleSentryTags({ detail }),
    frames: detail?.frames ?? [],
    breadcrumbs,
    breadcrumbCount: breadcrumbs.length,
    hasBreadcrumbs: breadcrumbs.length > 0 && !isLoading && error == null,
  };
};
