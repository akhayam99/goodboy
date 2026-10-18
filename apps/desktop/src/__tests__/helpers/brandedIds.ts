import type {
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  WorkspaceId,
} from '@goodboy/types';

const isBindingId = (value: string): value is IntegrationBindingId => value.length > 0;
const isCredentialId = (value: string): value is IntegrationCredentialId => value.length > 0;
const isWorkspaceId = (value: string): value is WorkspaceId => value.length > 0;
const isIsoDateTime = (value: string): value is IsoDateTime => value.length > 0;

type Params = {
  readonly value: string;
};

export const bindingIdOf = ({ value }: Params): IntegrationBindingId => {
  if (!isBindingId(value)) {
    throw new Error('empty binding id');
  }
  return value;
};

export const credentialIdOf = ({ value }: Params): IntegrationCredentialId => {
  if (!isCredentialId(value)) {
    throw new Error('empty credential id');
  }
  return value;
};

export const workspaceIdOf = ({ value }: Params): WorkspaceId => {
  if (!isWorkspaceId(value)) {
    throw new Error('empty workspace id');
  }
  return value;
};

export const isoDateTimeOf = ({ value }: Params): IsoDateTime => {
  if (!isIsoDateTime(value)) {
    throw new Error('empty date');
  }
  return value;
};
