import { NAMES } from '../../../shared/names';

type Params = {
  readonly line:
    | Readonly<{ kind: 'orchestrated' }>
    | Readonly<{ kind: 'preset'; presetName: string }>
    | Readonly<{ kind: 'autoAgent' }>
    | Readonly<{ kind: 'agent'; role: string }>;
};

const SEPARATOR = ' · ';

export const runKindLineOf = ({ line }: Params): string => {
  const kinds = NAMES.runKind;
  switch (line.kind) {
    case 'orchestrated':
      return [kinds.workflow, kinds.orchestrated].join(SEPARATOR);
    case 'preset':
      return [kinds.workflow, `${kinds.preset} ${line.presetName}`].join(SEPARATOR);
    case 'autoAgent':
      return [kinds.agent, kinds.autoAgent].join(SEPARATOR);
    case 'agent':
      return [kinds.agent, line.role].join(SEPARATOR);
    default: {
      const unreachable: never = line;
      return unreachable;
    }
  }
};
