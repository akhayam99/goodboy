import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { serveHandoffCommandNames } from './serveHandoffCommandNames.mjs';

const names = ({ source }) => [...serveHandoffCommandNames({ source })].sort();

describe('serveHandoffCommandNames', () => {
  it('reads the reply command of a call with type arguments', () => {
    const source = `serveHandoff<MaterializeRequest, MaterializeOutcome>({
      event: MATERIALIZE_EVENT,
      command: 'project_materialize_result',
      label: 'materialize',
    });`;
    assert.deepEqual(names({ source }), ['project_materialize_result']);
  });

  it('reads one command per call and several calls in a file', () => {
    const source = `
      serveHandoff({ event: 'a', command: 'ledger_core_result', execute });
      serveHandoff<Request>({
        event: 'b',
        command: "notify_relay_result",
      });`;
    assert.deepEqual(names({ source }), ['ledger_core_result', 'notify_relay_result']);
  });

  it('ignores a command option that is not handed to serveHandoff', () => {
    const source = "const row = { command: 'payments_api_run' };";
    assert.deepEqual(names({ source }), []);
  });
});
