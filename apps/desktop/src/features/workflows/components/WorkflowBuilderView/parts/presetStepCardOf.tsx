import type { FactCardSpec } from '@goodboy/ui';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import type { PresetStepMark } from '../../../presetStepMarksOf';

type Params = {
  readonly mark: PresetStepMark;
};

export const presetStepCardOf = ({ mark }: Params): FactCardSpec => ({
  glyph: <AgentKindChip kind={mark.kind} density="glyph" isDecorative />,
  title: mark.roleName,
  sub: `Step ${mark.position} of ${mark.total}`,
  facts: [
    { label: 'Model', value: mark.model },
    ...(mark.effort === null ? [] : [{ label: 'Effort', value: mark.effort }]),
    { label: 'Instruction', value: mark.instruction },
    ...(mark.handsOn === null ? [] : [{ label: 'Hands on', value: mark.handsOn }]),
  ],
});
