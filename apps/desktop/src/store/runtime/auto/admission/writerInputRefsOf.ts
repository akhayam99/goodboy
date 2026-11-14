import { isAutoWriterRole, parseAutoDelegationRole } from '@goodboy/core/auto';
import type { AutoDelegation } from '@goodboy/db';
import { isRecord } from '@goodboy/types/helpers';

export type WriterInputRef = Readonly<{ artifactId: string; revision: number }>;

type Params = { readonly delegation: AutoDelegation };

export const writerInputRefsOf = ({ delegation }: Params): ReadonlyArray<WriterInputRef> => {
  const role = parseAutoDelegationRole({ role: delegation.role });
  if (role === null || !isAutoWriterRole({ role })) {
    return [];
  }
  const inputs = delegation.request['inputArtifacts'];
  return (Array.isArray(inputs) ? inputs : []).flatMap((input: unknown) =>
    isRecord(input) &&
    typeof input['artifactId'] === 'string' &&
    typeof input['revision'] === 'number'
      ? [{ artifactId: input['artifactId'], revision: input['revision'] }]
      : [],
  );
};
