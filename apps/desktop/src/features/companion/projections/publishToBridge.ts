import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { projectionMetaOf } from './projectionMetaOf';
import type { ProjectionDraft } from './projectionFieldsOf';

export type PublishReport = {
  readonly rejected: ReadonlyArray<{ readonly key: string; readonly reason: string }>;
};

type Params = {
  readonly changed: ReadonlyArray<ProjectionDraft>;
  readonly removed: ReadonlyArray<string>;
  readonly epoch: number;
  readonly seq: number;
  readonly now: number;
};

export const publishToBridge = ({
  changed,
  removed,
  epoch,
  seq,
  now,
}: Params): Promise<PublishReport> => {
  const meta = projectionMetaOf({ epoch, seq, now });
  return invokeCommand<PublishReport>('bridge_publish', {
    epoch,
    items: changed.map((draft) => ({
      key: draft.key,
      kind: draft.kind,
      projection: { ...meta, ...draft.fields },
    })),
    removed,
  });
};
