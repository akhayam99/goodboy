import type { AutoArtifactLedgerRow } from '@goodboy/db';
import { withoutRawIdsOf } from '../withoutRawIdsOf';

type Params = {
  readonly text: string;
  readonly artifacts: ReadonlyArray<AutoArtifactLedgerRow>;
};

export const readableTaskOf = ({ text, artifacts }: Params): string => {
  const named = artifacts.reduce((current, row) => {
    const { artifactId, kind } = row.artifact;
    return [`${kind} artifact ${artifactId}`, `artifact ${artifactId}`, artifactId].reduce(
      (written, phrase) => written.split(phrase).join(row.title),
      current,
    );
  }, text);
  return withoutRawIdsOf({ text: named });
};
