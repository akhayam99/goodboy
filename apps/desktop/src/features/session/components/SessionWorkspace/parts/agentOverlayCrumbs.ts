import type { BreadcrumbCrumb } from '../../../../../app/components/AppBreadcrumb/buildBreadcrumb';

type Params = {
  readonly homeLabel: string;
  readonly agentName: string | null;
  readonly onHome: () => void;
};

export const agentOverlayCrumbs = ({
  homeLabel,
  agentName,
  onHome,
}: Params): ReadonlyArray<BreadcrumbCrumb> => {
  const home: BreadcrumbCrumb = { id: 'overlay-home', label: homeLabel, onClick: onHome };
  if (agentName == null) {
    return [home];
  }
  return [home, { id: 'overlay-agent', label: agentName }];
};
