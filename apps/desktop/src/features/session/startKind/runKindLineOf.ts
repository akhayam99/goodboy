import { NAMES } from '../../../shared/utils/names';

type Params = {
  readonly line:
    | Readonly<{ kind: 'lead'; planName: string | null }>
    | Readonly<{ kind: 'orchestrated' }>
    | Readonly<{ kind: 'preset'; presetName: string }>
    | Readonly<{ kind: 'agent'; role: string }>;
};

const SEPARATOR = ' · ';

export const runKindLineOf = ({ line }: Params): string => {
  const kinds = NAMES.runKind;
  switch (line.kind) {
    case 'lead':
      return line.planName === null || line.planName.trim() === ''
        ? NAMES.lead
        : [NAMES.lead, `${kinds.plan} ${line.planName.trim()}`].join(SEPARATOR);
    case 'orchestrated':
      return [kinds.workflow, kinds.orchestrated].join(SEPARATOR);
    case 'preset':
      return [kinds.workflow, `${kinds.preset} ${line.presetName}`].join(SEPARATOR);
    case 'agent':
      return [kinds.agent, line.role].join(SEPARATOR);
    default: {
      const unreachable: never = line;
      return unreachable;
    }
  }
};
