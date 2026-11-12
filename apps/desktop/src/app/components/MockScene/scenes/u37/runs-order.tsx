import type { ComponentType } from 'react';
import { C08RunScene } from '../u25/C08RunScene';
import { seedRunsOrder } from './runsOrderSeed';

export const U37_RUNS_ORDER_SCENES = {
  'u37-runs-order': () => (
    <C08RunScene state="working" selection="list" theme="dark" extra={seedRunsOrder} />
  ),
  'u37-runs-order-light': () => (
    <C08RunScene state="working" selection="list" theme="light" extra={seedRunsOrder} />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
