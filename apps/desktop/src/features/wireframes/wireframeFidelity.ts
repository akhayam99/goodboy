export const WIREFRAME_FIDELITIES = ['low', 'high'] as const;

export type WireframeFidelity = (typeof WIREFRAME_FIDELITIES)[number];

export const WIREFRAME_FIDELITY_LABEL: Record<WireframeFidelity, string> = {
  low: 'Low fidelity',
  high: 'High fidelity',
};

export const WIREFRAME_FIDELITY_HINT: Record<WireframeFidelity, string> = {
  low: 'neutral greys, placeholder media and layout annotations',
  high: 'the design profile read from the mounted repo, generic theme when there is no evidence',
};

export const asWireframeFidelity = ({
  value,
}: {
  readonly value: string;
}): WireframeFidelity | null =>
  (WIREFRAME_FIDELITIES as ReadonlyArray<string>).includes(value)
    ? (value as WireframeFidelity)
    : null;
