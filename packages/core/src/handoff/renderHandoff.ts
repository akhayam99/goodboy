import type { ProviderId } from '@goodboy/types';

export type HandoffClusterBoundary = Readonly<{
  marker: string;
  block: string;
}>;

export type HandoffBodyLayers = Readonly<{
  message: string;
  contextPreamble: string;
  childRouting: string;
  clusterBoundary: HandoffClusterBoundary | null;
  goalAttachments: string;
  priorTurns: string;
  verbosity: string;
}>;

export type HandoffLayers = HandoffBodyLayers &
  Readonly<{
    provider: ProviderId;
    guards: string;
    roleInstructions: string;
  }>;

export type RenderedHandoff = Readonly<{
  body: string;
  system: string;
  message: string;
}>;

type PrependParams = {
  readonly block: string;
  readonly text: string;
};

const prepend = ({ block, text }: PrependParams): string =>
  block.length > 0 ? `${block}\n\n${text}` : text;

export const composeHandoffBody = (layers: HandoffBodyLayers): string => {
  const withPreamble = prepend({ block: layers.contextPreamble, text: layers.message });
  const withRouting = prepend({ block: layers.childRouting, text: withPreamble });
  const boundary = layers.clusterBoundary;
  const withBoundary =
    boundary !== null && !withRouting.includes(boundary.marker)
      ? `${boundary.block}\n\n${withRouting}`
      : withRouting;
  const withAttachments = prepend({ block: layers.goalAttachments, text: withBoundary });
  const withPriorTurns = prepend({ block: layers.priorTurns, text: withAttachments });
  return `${layers.verbosity}\n\n${withPriorTurns}`;
};

type SystemParams = {
  readonly guards: string;
  readonly roleInstructions: string;
};

const composeSystem = ({ guards, roleInstructions }: SystemParams): string =>
  roleInstructions.length > 0 ? `${guards}\n\n${roleInstructions}` : guards;

type MessageParams = {
  readonly provider: ProviderId;
  readonly body: string;
  readonly guards: string;
  readonly roleInstructions: string;
};

const composeMessage = ({ provider, body, guards, roleInstructions }: MessageParams): string => {
  if (provider === 'anthropic') {
    return body;
  }
  const roleBlock =
    roleInstructions.length > 0 ? `[role-boundary]\n${roleInstructions}\n[/role-boundary]\n\n` : '';
  return `${guards}\n\n${roleBlock}${body}`;
};

export const renderHandoff = (layers: HandoffLayers): RenderedHandoff => {
  const body = composeHandoffBody(layers);
  return {
    body,
    system: composeSystem({ guards: layers.guards, roleInstructions: layers.roleInstructions }),
    message: composeMessage({
      provider: layers.provider,
      body,
      guards: layers.guards,
      roleInstructions: layers.roleInstructions,
    }),
  };
};

type ProviderParams = {
  readonly provider: ProviderId;
};

export const hasSeparateSystemPrompt = ({ provider }: ProviderParams): boolean =>
  provider === 'anthropic';
