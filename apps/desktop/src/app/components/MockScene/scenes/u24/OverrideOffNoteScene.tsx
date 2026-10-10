import { DecisionNoteRow } from '../../../../../features/chat/components/TranscriptCards/DecisionNoteRow';
import { overrideOffNoticeMessage } from '../../../../../store/slices/turn/overrideOffNoticeMessage';

export const OverrideOffNoteScene = () => (
  <main className="flex h-screen items-center justify-center bg-background text-foreground">
    <div className="flex w-full max-w-prose flex-col gap-3 p-6">
      <DecisionNoteRow message={overrideOffNoticeMessage({ provider: 'cursor', scope: 'turn' })} />
    </div>
  </main>
);
