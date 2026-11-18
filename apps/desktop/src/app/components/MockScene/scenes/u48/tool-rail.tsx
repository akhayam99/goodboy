import { P10RightDockScene } from '../u39/P10RightDockScene';

export const U48_TOOL_RAIL_SCENES = {
  'u48-tool-rail-closed': () => <P10RightDockScene context="session" view="session" held={null} />,
  'u48-tool-rail-monitor': () => (
    <P10RightDockScene context="session" view="session" held="monitoring" />
  ),
  'u48-tool-rail-detail-monitor': () => (
    <P10RightDockScene context="session" view="session" held="monitoring" hasDetail />
  ),
};
