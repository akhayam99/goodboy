import type { FactCardSpec, Tone } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { factStateToneOf } from '../../../shared/utils/factStateToneOf';
import type { AgentKind } from '../../../features/session/agent-kind';

type Params = {
  readonly name: string;
  readonly kind: AgentKind;
  readonly tone: Tone;
  readonly word: string;
  readonly isRunning: boolean;
};

export const runAgentCardOf = ({ name, kind, tone, word, isRunning }: Params): FactCardSpec => ({
  glyph: <AgentKindChip kind={kind} density="glyph" isDecorative />,
  title: name,
  state: { tone: factStateToneOf({ tone }), words: word, isRunning },
  facts: [],
});
