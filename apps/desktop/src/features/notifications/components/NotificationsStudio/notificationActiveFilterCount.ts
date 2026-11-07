import type { NotificationFilters } from '../../facets';

type Params = {
  readonly filters: NotificationFilters;
};

export const notificationActiveFilterCount = ({ filters }: Params): number =>
  [filters.view !== 'all', filters.severity != null, filters.source != null].filter(
    (isActive) => isActive,
  ).length;
