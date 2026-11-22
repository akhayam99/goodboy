export const PLACE_ROWS = {
  contextSection: 'context.section',
  changesMode: 'changes.mode',
  filesOpen: 'files.open',
  filesMount: 'files.mount',
  runsFilter: 'runs.filter',
  boardLead: 'board.lead',
  boardLayout: 'board.layout',
  boardMove: 'board.move',
} as const satisfies Readonly<Record<string, string>>;
