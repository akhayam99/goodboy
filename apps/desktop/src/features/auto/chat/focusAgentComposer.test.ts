// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { focusAgentComposer } from './focusAgentComposer';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focusAgentComposer', () => {
  it('lands in the message field, not in a question docked above it', () => {
    document.body.innerHTML = `
      <div data-drop-composer>
        <div data-conversation-dock><textarea aria-label="Your answer"></textarea></div>
        <div data-composer-field><textarea aria-label="Message to the agent"></textarea></div>
      </div>`;

    focusAgentComposer();

    expect(document.activeElement?.getAttribute('aria-label')).toBe('Message to the agent');
  });
});
