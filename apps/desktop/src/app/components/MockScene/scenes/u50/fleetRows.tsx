import type { ComponentType } from 'react';
import { FleetRowsScene } from './FleetRowsScene';

export const U50_FLEET_ROWS_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-fleet-rows-light': () => <FleetRowsScene theme="light" />,
  'u50-fleet-rows-dark': () => <FleetRowsScene theme="dark" />,
};
