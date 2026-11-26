import { RAIL_TOOLS } from '../../../features/session/components/SessionTools/sessionTools';

type Params = {
  readonly key: string;
};

export const dockToolLabelOf = ({ key }: Params): string =>
  RAIL_TOOLS.find((tool) => tool.pane === key)?.label ?? key;
