import type { BuiltPrompt } from './buildTurnPrompt';
import type { BuiltSpawn } from './buildTurnSpawn';
import type { LeasedTurn } from './leaseTurnWriter';
import type { PreparedTurn } from './prepareTurn';
import type { RoutedTurn } from './routeTurn';
import type { StartedTurn } from './startTurnRun';
import type { WithInput } from './types';

export type TurnContext = WithInput &
  PreparedTurn &
  RoutedTurn &
  LeasedTurn &
  StartedTurn &
  BuiltPrompt &
  BuiltSpawn;
