import type { AskBackend } from './askBackend';
import { tauriAskBackend } from './tauriAskBackend';

type RegisterParams = {
  readonly backend: AskBackend;
};

export const activeAskBackend: AskBackend = { ...tauriAskBackend };

export const registerAskBackend = ({ backend }: RegisterParams): void => {
  Object.assign(activeAskBackend, backend);
};
