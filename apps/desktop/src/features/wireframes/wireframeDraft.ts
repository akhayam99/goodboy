import type { TurnEvent } from '@goodboy/types';
import type { WireframeChangeScope, WireframePickedNode } from './buildWireframeChangeRequest';

export type WireframeDraftRequest = Readonly<{
  ask: string;
  scope: WireframeChangeScope;
  screenId: string | null;
  picked: ReadonlyArray<WireframePickedNode>;
}>;

export type WireframeDraft = WireframeDraftRequest &
  Readonly<{
    fromRevision: number;
    startedAt: number;
  }> &
  (
    | Readonly<{ status: 'drafting' }>
    | Readonly<{ status: 'ready'; toRevision: number; settledAt: number }>
    | Readonly<{ status: 'failed'; reason: string; detail: string | null }>
  );

export const DRAFT_NO_VERSION_REASON = 'The agent answered without a new version.';

export const draftFailure = ({
  events,
  since,
}: {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly since: number;
}): Readonly<{ reason: string; detail: string | null }> => {
  const recent = events.filter((event) => Date.parse(event.at) >= since);
  const capture = [...recent].reverse().find((event) => event.kind === 'artifact_capture_failed');
  if (capture !== undefined && capture.kind === 'artifact_capture_failed') {
    const reason = capture.message.replace(
      /^the wireframe document does not match the contract:\s*/,
      '',
    );
    return { reason: `It did not pass the checks: ${reason}`, detail: capture.message };
  }
  const error = [...recent].reverse().find((event) => event.kind === 'error');
  if (error !== undefined && error.kind === 'error') {
    return { reason: 'The agent stopped with an error.', detail: error.message };
  }
  return { reason: DRAFT_NO_VERSION_REASON, detail: null };
};
