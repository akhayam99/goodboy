import { LayoutFlowScene } from './LayoutFlowScene';

export const U34_LAYOUT_FLOW_SCENES = {
  'u34-u28-agents-open': () => <LayoutFlowScene />,
  'u34-u28-drawer-closed': () => <LayoutFlowScene isDrawerOpen={false} />,
  'u34-u29-narrow-running': () => <LayoutFlowScene isDrawerOpen={false} isNarrowRow />,
  'u34-u24-folded-sessions': () => <LayoutFlowScene isFolded />,
  'u34-u30-active-tool': () => <LayoutFlowScene />,
  'u34-u31-folded-branches': () => <LayoutFlowScene isFolded />,
  'u34-p18-folded-branches-4': () => <LayoutFlowScene isFolded isFourBranches />,
  'u34-p18-running-4-branches': () => <LayoutFlowScene isDrawerOpen={false} isFourBranches />,
};
