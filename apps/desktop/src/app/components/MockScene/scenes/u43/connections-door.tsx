import type { ComponentType } from 'react';
import { ConnectionsDoorScene } from './ConnectionsDoorScene';

export const U43_CONNECTIONS_DOOR_SCENES: Readonly<Record<string, ComponentType>> = {
  'connections-door': () => <ConnectionsDoorScene theme="light" />,
  'connections-door-dark': () => <ConnectionsDoorScene theme="dark" />,
};
