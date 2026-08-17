import type { BreadcrumbCrumb } from '../../../../../app/components/AppBreadcrumb/buildBreadcrumb';

type Params = {
  readonly homeLabel: string;
  readonly agentName: string | null;
  readonly onOverview: () => void;
  readonly onHome: () => void;
};

export const agentOverlayCrumbs = ({
  homeLabel,
  agentName,
  onOverview,
  onHome,
}: Params): ReadonlyArray<BreadcrumbCrumb> => {
  const overview: BreadcrumbCrumb = {
    id: 'overview',
    label: 'Overview',
    onClick: onOverview,
  };
  const home: BreadcrumbCrumb = { id: 'overlay-home', label: homeLabel, onClick: onHome };
  if (agentName == null) {
    return [overview, home];
  }
  return [overview, home, { id: 'overlay-agent', label: agentName }];
};
