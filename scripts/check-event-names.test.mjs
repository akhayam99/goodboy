import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  frontendTauriCalls,
  rustEventNames,
  verifyEventNames,
  windowEventNames,
} from './check-event-names.mjs';

const RUST = `
pub const EVENT_NAME: &str = "turn_event";
const MOUNT_EVENT: &str = "query-bridge://mount-command";
fn run(app: &AppHandle) {
    let _ = app.emit(
        "terminal-output",
        payload,
    );
    let _ = app.emit(EVENT_NAME, payload);
}
`;

const FRONTEND = `
const PRESENCE_EVENT = 'goodboy:presence';
const MOUNT_EVENT = 'query-bridge://mount-command';
listen<Envelope>('turn_event', handler);
listen(MOUNT_EVENT, handler);
emit(PRESENCE_EVENT, payload);
listen(PRESENCE_EVENT, handler);
createOutputStream({ outputEvent: 'terminal-output' });
`;

const DOC = [
  '## Events from Rust',
  '| `turn_event` | | | |',
  '| `query-bridge://mount-command` | | | |',
  '| `terminal-output` | | | |',
  '## Other',
  'The window event `goodboy:new-session` and `goodboy:link-issue:<sessionId>`, `goodboy:presence`.',
].join('\n');

const sources = ({ text }) => [{ path: 'a', text }];

const verify = ({
  rust = RUST,
  frontend = FRONTEND,
  window = '',
  doc = DOC,
  unheard = new Map(),
}) =>
  verifyEventNames({
    rustNames: rustEventNames({ sources: sources({ text: rust }) }),
    frontend: frontendTauriCalls({ sources: sources({ text: frontend }) }),
    windowNames: windowEventNames({ sources: sources({ text: window }) }),
    doc,
    unheard,
  });

describe('rustEventNames', () => {
  it('reads event constants and literal emits, and skips a dynamic name', () => {
    const names = rustEventNames({ sources: sources({ text: RUST }) });
    assert.deepEqual([...names].sort(), [
      'query-bridge://mount-command',
      'terminal-output',
      'turn_event',
    ]);
  });
});

describe('frontendTauriCalls', () => {
  it('resolves a constant to its value in the same file', () => {
    const { listened, emitted } = frontendTauriCalls({ sources: sources({ text: FRONTEND }) });
    assert.deepEqual([...listened].sort(), [
      'goodboy:presence',
      'query-bridge://mount-command',
      'turn_event',
    ]);
    assert.deepEqual([...emitted], ['goodboy:presence']);
  });
});

describe('verifyEventNames', () => {
  it('accepts names that agree on every side', () => {
    assert.deepEqual(verify({}), []);
  });

  it('reports a Rust rename the frontend does not know', () => {
    const problems = verify({ rust: RUST.replace('turn_event', 'turn_event_v2') });
    assert.match(problems.join('\n'), /Rust emits "turn_event_v2" and no frontend file names it/);
    assert.match(problems.join('\n'), /the frontend listens to "turn_event" and neither/);
  });

  it('reports a Rust event the doc section does not list', () => {
    const problems = verify({ doc: DOC.replace('`terminal-output`', '`terminal-out`') });
    assert.match(problems.join('\n'), /"terminal-output" is emitted by Rust and missing/);
  });

  it('accepts a documented event whose listener has not landed, until the frontend names it', () => {
    const rust = `${RUST}\nconst TAB_OPENED_EVENT: &str = "browser://tab-opened";`;
    const doc = DOC.replace('## Other', '| `browser://tab-opened` | | | |\n## Other');
    const unheard = new Map([['browser://tab-opened', 'the pane lands later']]);
    assert.deepEqual(verify({ rust, doc, unheard }), []);
    assert.match(
      verify({ rust, doc }).join('\n'),
      /Rust emits "browser:\/\/tab-opened" and no frontend file names it/,
    );
    const frontend = `${FRONTEND}\nlisten('browser://tab-opened', handler);`;
    assert.match(
      verify({ rust, doc, unheard, frontend }).join('\n'),
      /the frontend names "browser:\/\/tab-opened" now/,
    );
  });

  it('reports a window event the doc does not list, and accepts one with an id suffix', () => {
    const window = "window.dispatchEvent(new CustomEvent('goodboy:brand-new'));";
    const problems = verify({ window });
    assert.match(problems.join('\n'), /window event "goodboy:brand-new" is not in/);
    const suffixed = 'const name = `goodboy:link-issue:${sessionId}`;';
    assert.deepEqual(verify({ window: suffixed }), []);
  });
});
