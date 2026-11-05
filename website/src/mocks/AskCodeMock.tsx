import './AskCodeMock.css';
import { MockStage } from './MockStage';
import { MockChip } from './MockChip';
import { MockRow } from './MockRow';
import { MockWindow } from './MockWindow';

const SOURCES: readonly string[] = [
  'payments-api/src/credits/apply.ts',
  'notify-relay/src/retry/backoff.ts',
];

export const AskCodeMock = () => (
  <MockStage label="Ask about the code. The question is why retried webhooks post a second credit. The answer cites one file in payments-api and one in notify-relay. Read only.">
    <MockWindow
      className="askWin"
      title={
        <>
          <span>Workspace chat</span>
          <span className="mkSpacer" />
          <MockChip tone="neutral">Codex</MockChip>
        </>
      }
    >
      <MockRow className="askQ">
        <span className="mkMuted">You</span>
        <span className="mkGrow">Why do retried webhooks post a second credit?</span>
      </MockRow>
      <MockRow className="askA">
        <span className="mkMuted">Answer</span>
        <span className="mkGrow">
          notify-relay resends a webhook after a timeout. payments-api applies the credit again
          because it never checks the delivery id.
        </span>
      </MockRow>
      <MockRow className="askSources">
        {SOURCES.map((source) => (
          <MockChip key={source} className="mkMono askFile">
            {source}
          </MockChip>
        ))}
      </MockRow>
      <MockRow className="askComposer">
        <span className="mkMuted">Ask across your projects</span>
        <span className="mkSpacer" />
        <span className="askSend">Send</span>
      </MockRow>
    </MockWindow>
  </MockStage>
);
