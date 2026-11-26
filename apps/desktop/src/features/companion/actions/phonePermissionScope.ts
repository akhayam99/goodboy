export type PhonePermission = 'merge' | 'start';

type ScopeParams = {
  readonly phoneId: string | null;
  readonly permission: PhonePermission;
};

export type PhoneScope = (params: ScopeParams) => boolean;

const ALLOW_ALL: PhoneScope = () => true;

let scope: PhoneScope = ALLOW_ALL;

type RegisterParams = {
  readonly read: PhoneScope;
};

export const registerPhoneScope = ({ read }: RegisterParams): void => {
  scope = read;
};

export const resetPhoneScope = (): void => {
  scope = ALLOW_ALL;
};

export const mayFromPhone = ({ phoneId, permission }: ScopeParams): boolean =>
  scope({ phoneId, permission });
