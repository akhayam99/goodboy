import { useContext } from 'react';
import { DrawerEdgeContext } from '@goodboy/ui';
import { ShellToolRail } from '../ShellToolRail';

type Props = {
  readonly shellEdge: HTMLElement | null;
};

export const StudioRail = ({ shellEdge }: Props) => {
  const panelEdge = useContext(DrawerEdgeContext);
  return (
    <DrawerEdgeContext.Provider value={panelEdge ?? shellEdge}>
      <ShellToolRail />
    </DrawerEdgeContext.Provider>
  );
};
