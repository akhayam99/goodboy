import type { AgentId } from '@goodboy/types';
import type { SessionFace } from '../session-view/types';
import type { BranchTab } from './types';

export type DeskTool =
  | { readonly kind: 'agent'; readonly agentId: AgentId }
  | { readonly kind: 'pr'; readonly mountId: string; readonly tab: BranchTab }
  | { readonly kind: 'terminal'; readonly mountId: string | null };

export type DeskToolKind = DeskTool['kind'];

export type LandingMove = {
  readonly kind: string;
  readonly mountId: string | null;
  readonly agentId?: AgentId | null;
};

export type LandingDoor = 'place' | 'move' | 'desk';

export type Landing =
  | { readonly face: 'overview'; readonly reason: string | null }
  | { readonly face: 'desk'; readonly isKept: true }
  | { readonly face: 'desk'; readonly isKept: false; readonly tools: ReadonlyArray<DeskTool> };

export type LandingParams = {
  readonly door: LandingDoor;
  readonly move: LandingMove | null;
  readonly lastFace: SessionFace | null;
  readonly hasKept: boolean;
  readonly next: ReadonlyArray<LandingMove>;
  readonly nowAgentId: AgentId | null;
  readonly firstMountId: string | null;
  readonly hasWorkspaceFolder: boolean;
  readonly canOpen: ReadonlySet<DeskToolKind>;
};

type MoveParams = {
  readonly move: LandingMove;
};

type TabParams = MoveParams & {
  readonly tab: BranchTab;
};

type OpenParams = MoveParams & Pick<LandingParams, 'canOpen'>;

export const DESK_OFF_REASON = 'Mount a project or pick a workspace folder to open the Desk';

const agentToolOf = ({ move }: MoveParams): ReadonlyArray<DeskTool> =>
  move.agentId == null ? [] : [{ kind: 'agent', agentId: move.agentId }];

const prToolOf = ({ move, tab }: TabParams): ReadonlyArray<DeskTool> =>
  move.mountId === null ? [] : [{ kind: 'pr', mountId: move.mountId, tab }];

const terminalToolOf = ({ move }: MoveParams): ReadonlyArray<DeskTool> =>
  move.mountId === null ? [] : [{ kind: 'terminal', mountId: move.mountId }];

const DESK_MOVES: Readonly<Record<string, (params: MoveParams) => ReadonlyArray<DeskTool>>> = {
  'fix-checks': ({ move }) => [
    ...agentToolOf({ move }),
    ...prToolOf({ move, tab: 'checks' }),
    ...terminalToolOf({ move }),
  ],
  'rerun-check': ({ move }) => [...prToolOf({ move, tab: 'checks' }), ...terminalToolOf({ move })],
  'rebase-project': ({ move }) => [...agentToolOf({ move }), ...terminalToolOf({ move })],
  'resolve-threads': ({ move }) => [
    ...agentToolOf({ move }),
    ...prToolOf({ move, tab: 'comments' }),
  ],
  'run-failing-test': terminalToolOf,
  'next-script': terminalToolOf,
};

const isDeskMove = ({ move }: MoveParams): boolean => Object.hasOwn(DESK_MOVES, move.kind);

const toolsOfMove = ({ move, canOpen }: OpenParams): ReadonlyArray<DeskTool> => {
  if (!isDeskMove({ move })) {
    return [];
  }
  return (DESK_MOVES[move.kind]?.({ move }) ?? []).filter((tool) => canOpen.has(tool.kind));
};

const deskChainOf = ({
  hasKept,
  next,
  nowAgentId,
  firstMountId,
  hasWorkspaceFolder,
  canOpen,
}: LandingParams): Landing => {
  if (hasKept) {
    return { face: 'desk', isKept: true };
  }
  const fromNext = next
    .map((move) => toolsOfMove({ move, canOpen }))
    .find((tools) => tools.length > 0);
  if (fromNext !== undefined) {
    return { face: 'desk', isKept: false, tools: fromNext };
  }
  if (nowAgentId !== null && canOpen.has('agent')) {
    return { face: 'desk', isKept: false, tools: [{ kind: 'agent', agentId: nowAgentId }] };
  }
  if (!canOpen.has('terminal')) {
    return { face: 'overview', reason: DESK_OFF_REASON };
  }
  if (firstMountId !== null) {
    return { face: 'desk', isKept: false, tools: [{ kind: 'terminal', mountId: firstMountId }] };
  }
  if (hasWorkspaceFolder) {
    return { face: 'desk', isKept: false, tools: [{ kind: 'terminal', mountId: null }] };
  }
  return { face: 'overview', reason: DESK_OFF_REASON };
};

export const landingOf = ({ door, move, lastFace, ...rest }: LandingParams): Landing => {
  const params: LandingParams = { door, move, lastFace, ...rest };
  if (door === 'move' && move !== null) {
    if (!isDeskMove({ move })) {
      return { face: 'overview', reason: null };
    }
    const tools = toolsOfMove({ move, canOpen: rest.canOpen });
    return tools.length > 0 ? { face: 'desk', isKept: false, tools } : deskChainOf(params);
  }
  if (door === 'place' && (lastFace ?? 'overview') === 'overview') {
    return { face: 'overview', reason: null };
  }
  return deskChainOf(params);
};
