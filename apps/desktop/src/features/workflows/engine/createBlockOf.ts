import type { WorkflowDraft } from './types';

type Params = {
  readonly draft: WorkflowDraft;
  readonly takenNames: ReadonlySet<string>;
  readonly isDrafting: boolean;
};

export type CreateBlock = {
  readonly reason: string | null;
  readonly nameError: string | null;
};

export const createBlockOf = ({ draft, takenNames, isDrafting }: Params): CreateBlock => {
  const name = draft.name.trim();
  if (name.length === 0) {
    return { reason: 'Name it first', nameError: null };
  }
  if (takenNames.has(name)) {
    return { reason: null, nameError: `A workflow named ${name} exists` };
  }
  if (isDrafting) {
    return { reason: 'Steps are being drafted', nameError: null };
  }
  if (draft.steps.length === 0) {
    return { reason: 'Add one step or draft them', nameError: null };
  }
  if (draft.steps.some((step) => step.name.trim().length === 0)) {
    return { reason: 'Name every step', nameError: null };
  }
  return { reason: null, nameError: null };
};
