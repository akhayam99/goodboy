import type { WireframeFidelity } from './wireframeFidelity';

export const WIREFRAME_FIDELITY_DOWNGRADE_NOTE =
  'fidelity forced to low: no design source survived for this agent, so the theme it claimed is not backed by anything read from the repository';

export type CapturedWireframeFidelity = Readonly<{
  fidelity: WireframeFidelity;
  note: string | null;
}>;

type Params = Readonly<{
  requested: WireframeFidelity | null;
  claimed: WireframeFidelity;
  hasDesignSource: boolean;
}>;

export const capturedWireframeFidelity = ({
  requested,
  claimed,
  hasDesignSource,
}: Params): CapturedWireframeFidelity => {
  if (requested === 'high' && hasDesignSource) {
    return { fidelity: 'high', note: null };
  }
  if (claimed === 'high') {
    return { fidelity: 'low', note: WIREFRAME_FIDELITY_DOWNGRADE_NOTE };
  }
  return { fidelity: 'low', note: null };
};
