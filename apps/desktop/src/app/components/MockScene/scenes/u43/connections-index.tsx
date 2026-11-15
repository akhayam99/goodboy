import type { ComponentType } from 'react';
import { ConnectionsIndexScene } from './ConnectionsIndexScene';

export const U43_CONNECTIONS_INDEX_SCENES: Readonly<Record<string, ComponentType>> = {
  'connections-index': () => <ConnectionsIndexScene theme="light" variant="healthy" />,
  'connections-index-dark': () => <ConnectionsIndexScene theme="dark" variant="healthy" />,
  'connections-index-warnings': () => <ConnectionsIndexScene theme="light" variant="warnings" />,
  'connections-index-warnings-dark': () => (
    <ConnectionsIndexScene theme="dark" variant="warnings" />
  ),
  'connections-index-empty': () => <ConnectionsIndexScene theme="light" variant="empty" />,
  'connections-index-no-workspace': () => (
    <ConnectionsIndexScene theme="light" variant="no-workspace" />
  ),
};
