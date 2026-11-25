type ScopeParams = {
  readonly phoneId: string | null;
};

export type DecideScope = (params: ScopeParams) => boolean;

const ALLOW_ALL: DecideScope = () => true;

let scope: DecideScope = ALLOW_ALL;

type RegisterParams = {
  readonly read: DecideScope;
};

export const registerDecideScope = ({ read }: RegisterParams): void => {
  scope = read;
};

export const resetDecideScope = (): void => {
  scope = ALLOW_ALL;
};

export const mayDecideFromPhone = ({ phoneId }: ScopeParams): boolean => scope({ phoneId });
