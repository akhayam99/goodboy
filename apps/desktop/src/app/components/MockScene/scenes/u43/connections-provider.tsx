import type { ComponentType } from 'react';
import { ConnectionsProviderScene } from './ConnectionsProviderScene';

export const U43_CONNECTIONS_PROVIDER_SCENES: Readonly<Record<string, ComponentType>> = {
  'connections-provider-anthropic': () => (
    <ConnectionsProviderScene provider="anthropic" theme="light" />
  ),
  'connections-provider-anthropic-dark': () => (
    <ConnectionsProviderScene provider="anthropic" theme="dark" />
  ),
  'connections-provider-cursor': () => <ConnectionsProviderScene provider="cursor" theme="light" />,
  'connections-provider-codex': () => <ConnectionsProviderScene provider="codex" theme="light" />,
  'connections-provider-opencode': () => (
    <ConnectionsProviderScene provider="opencode" theme="light" />
  ),
  'connections-provider-openrouter': () => (
    <ConnectionsProviderScene provider="openrouter" theme="light" />
  ),
  'connections-provider-gemini': () => <ConnectionsProviderScene provider="gemini" theme="light" />,
  'connections-provider-copilot': () => (
    <ConnectionsProviderScene provider="copilot" theme="light" />
  ),
  'connections-provider-moonshot': () => (
    <ConnectionsProviderScene provider="moonshot" theme="light" />
  ),
};
