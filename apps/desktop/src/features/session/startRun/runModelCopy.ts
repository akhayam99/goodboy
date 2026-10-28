import { NAMES } from '../../../shared/utils/names';

type NameParams = {
  readonly name: string;
};

export const RUN_MODEL_COPY = {
  label: 'Model',
  orchestrator: 'Orchestrator',
  autoAgent: NAMES.role.auto,
  pinned: 'pinned',
  auto: 'Auto',
  reason: 'The default from Settings. A pick here is for this run only.',
  changeDefault: 'Change the default in Settings',
  forThisRun: ({ name }: NameParams) => `${name} model`,
} as const;
