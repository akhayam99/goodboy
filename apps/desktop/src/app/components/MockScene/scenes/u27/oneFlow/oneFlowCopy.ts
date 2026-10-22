export type OneFlowShape = 'plan' | 'lead';

export type OneFlowCloseness = 'follow' | 'adapt';

export const ONE_FLOW_COPY = {
  label: 'Start a run',
  placeholder: 'Describe what you want done. Auto picks how to run it.',
  hint: 'Auto picks a plan with steps, one agent, or one of your presets. You can change it once it starts.',
  start: 'Start',
  discard: 'Discard',
  runsTitle: 'Runs',
  routeLabel: 'How Auto runs this',
  change: 'Change',
  shapeHeader: 'Run it as',
  presetHeader: 'Start from',
  closenessHeader: 'With the preset',
  noPreset: 'No preset',
  remember: 'Start every run in this session like this',
  shapes: {
    plan: 'A plan with steps',
    lead: 'One agent that starts what it needs',
  },
  closeness: {
    follow: 'Follow the preset',
    adapt: 'Adapt as it goes',
  },
} as const;
