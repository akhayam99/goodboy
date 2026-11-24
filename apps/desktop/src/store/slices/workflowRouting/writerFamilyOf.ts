import { isAutoWriterRole, parseAutoDelegationRole } from '@goodboy/core/auto';
import { modelFamily, type ModelFamily } from '@goodboy/core/providers';
import type { AgentRole, ProviderId } from '@goodboy/types';

export type RoutedPick = Readonly<{
  role: AgentRole | null;
  provider: ProviderId | null;
  model: string | null;
}>;

type Params = {
  readonly role: AgentRole;
  readonly earlier: ReadonlyArray<RoutedPick>;
};

const isWriter = ({ role }: Pick<RoutedPick, 'role'>): boolean => {
  const parsed = parseAutoDelegationRole({ role });
  return parsed !== null && isAutoWriterRole({ role: parsed });
};

export const writerFamilyOf = ({ role, earlier }: Params): ModelFamily | null => {
  if (role !== 'reviewer') {
    return null;
  }
  const writer = [...earlier].reverse().find((pick) => isWriter({ role: pick.role }));
  if (writer?.provider == null || writer.model == null) {
    return null;
  }
  return modelFamily({ provider: writer.provider, model: writer.model });
};
