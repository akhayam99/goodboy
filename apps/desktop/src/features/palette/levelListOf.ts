import type { ResolvedAction } from '../actions/types';
import { buildActionList, buildChoiceList, type CommandSection } from './commandList';
import type { FrecencyState } from './frecency';
import type { PaletteEntry, PaletteStep } from './types';

type LevelShape = {
  readonly step: PaletteStep | null;
  readonly choicesOf: ResolvedAction | null;
};

type Params = {
  readonly level: LevelShape;
  readonly filter: string;
  readonly choices: ReadonlyArray<PaletteEntry>;
  readonly verbs: ReadonlyArray<PaletteEntry>;
  readonly frecency: FrecencyState;
  readonly now: number;
};

export const levelListOf = ({
  level,
  filter,
  choices,
  verbs,
  frecency,
  now,
}: Params): ReadonlyArray<CommandSection> => {
  if (level.step !== null) {
    return buildChoiceList({
      query: filter,
      title: level.step.title,
      choices: level.step.entries,
      frecency,
      now,
    });
  }
  if (level.choicesOf !== null) {
    return buildChoiceList({
      query: filter,
      title: level.choicesOf.label,
      choices,
      frecency,
      now,
    });
  }
  return buildActionList({ query: filter, verbs, frecency, now });
};
