import { describe, expectTypeOf, it } from 'vitest';
import type { SessionAttentionReason, SessionStage } from '@goodboy/types';
import type { StatusMarkSpec, StatusMarkState, Tone } from '@goodboy/ui';
import type { ArtifactKind, PrMergeMethod, WorkspaceIntegrationProvider } from '@goodboy/types';
import type { SessionArtifactKind } from './projections';
import type {
  AttentionReason,
  MergeMethod,
  SessionStage as ContractStage,
  StatusMark,
  StatusMarkState as ContractMarkState,
  TaskProvider,
  Tone as ContractTone,
} from './vocabulary';

describe('the contract vocabulary', () => {
  it('names the same attention reasons, stages, tones and marks as the app', () => {
    expectTypeOf<AttentionReason>().toEqualTypeOf<SessionAttentionReason>();
    expectTypeOf<ContractStage>().toEqualTypeOf<SessionStage>();
    expectTypeOf<ContractTone>().toEqualTypeOf<Tone>();
    expectTypeOf<ContractMarkState>().toEqualTypeOf<StatusMarkState>();
    expectTypeOf<StatusMark>().toEqualTypeOf<StatusMarkSpec>();
    expectTypeOf<MergeMethod>().toEqualTypeOf<PrMergeMethod>();
    expectTypeOf<SessionArtifactKind>().toEqualTypeOf<ArtifactKind>();
    expectTypeOf<TaskProvider>().toExtend<WorkspaceIntegrationProvider>();
  });
});
