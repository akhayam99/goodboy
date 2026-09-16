import type { WireframeAction } from '@goodboy/core';

export type WireframeSheetInteraction = Readonly<{
  currentScreenId: string;
  selectedNodeId: string | null;
  hotspots: ReadonlySet<string>;
  onSelect: (nodeId: string) => void;
  onAction: (params: { readonly nodeId: string; readonly action: WireframeAction | null }) => void;
  onOpenScreen: (screenId: string) => void;
}>;
