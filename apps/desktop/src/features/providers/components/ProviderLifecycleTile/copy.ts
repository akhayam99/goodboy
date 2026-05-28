import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';

// Pre-action copy shown above the CTA so the user knows what they are about
// to trigger. Kept short, ~1 sentence, no em-dashes. Per provider × action so
// the OAuth quirks (claude in browser, gemini bare-command, codex device flow)
// can be flagged honestly.

type CopyKey = `${ProviderId}.${ProviderLifecycleAction}`;

const COPY: Record<CopyKey, string> = {
  'anthropic.install': 'Installs the Claude Code CLI globally via npm. Takes about 10 seconds.',
  'anthropic.login': 'Opens your browser to sign in with your Anthropic account.',
  'anthropic.logout': 'Signs you out of Claude. You can sign back in any time.',
  'cursor.install': 'Installs the Cursor agent CLI. Runs the official installer script.',
  'cursor.login': 'Opens your browser to sign in with your Cursor account.',
  'cursor.logout': 'Signs you out of Cursor. You can sign back in any time.',
  'codex.install': 'Installs the OpenAI Codex CLI globally via npm. Takes about 10 seconds.',
  'codex.login': 'Opens your browser to sign in with your OpenAI account.',
  'codex.logout': 'Signs you out of Codex. You can sign back in any time.',
  'gemini.install': 'Installs the Google Gemini CLI globally via npm. Takes about 10 seconds.',
  'gemini.login': 'Opens your browser to sign in with your Google account.',
  'gemini.logout': 'Removes your Gemini credentials from this machine.',
};

export function copyFor(providerId: ProviderId, action: ProviderLifecycleAction): string {
  return COPY[`${providerId}.${action}`];
}
