export const WIREFRAME_FIDELITIES = ['low', 'high'] as const;

export type WireframeFidelity = (typeof WIREFRAME_FIDELITIES)[number];

export const WIREFRAME_FIDELITY_LABEL: Record<WireframeFidelity, string> = {
  low: 'Low fidelity',
  high: 'High fidelity',
};

export const WIREFRAME_FIDELITY_CHOICE_LABEL: Record<WireframeFidelity, string> = {
  low: 'Plain wireframe',
  high: 'Repository styled wireframe',
};

export const WIREFRAME_FIDELITY_VARIANT_LABEL: Record<WireframeFidelity, string> = {
  low: 'plain variant',
  high: 'repository styled variant',
};

export const WIREFRAME_FIDELITY_HINT: Record<WireframeFidelity, string> = {
  low: 'neutral greys, placeholder media and layout annotations',
  high: 'colors, type and radii read from the design files in the mounted repo. when the app finds no style evidence it says so and uses the generic theme instead',
};

export const requestedWireframeFidelity = ({
  agentName,
}: {
  readonly agentName: string | null;
}): WireframeFidelity | null =>
  agentName === null
    ? null
    : (WIREFRAME_FIDELITIES.find(
        (candidate) => WIREFRAME_FIDELITY_LABEL[candidate] === agentName.trim(),
      ) ?? null);

export const asWireframeFidelity = ({
  value,
}: {
  readonly value: string;
}): WireframeFidelity | null =>
  (WIREFRAME_FIDELITIES as ReadonlyArray<string>).includes(value)
    ? (value as WireframeFidelity)
    : null;
