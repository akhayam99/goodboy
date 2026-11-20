export const LEGACY_GATE_TEXTS = {
  noProgress:
    'Auto answered three times in a row without handing work over or saying anything. Retry to try again.',
  budget: 'The budget left does not cover another Auto turn. Raise the limit to go on.',
  returns:
    'Agents came back to Auto more than 6 times in 30 minutes. Retry to let Auto decide again, or tell it what to change.',
  staleDecide: 'Auto stopped answering before it replied. Retry to send the message again.',
  timeLimit: 'This conversation reached its time limit.',
  refusedPrefix: 'Auto kept trying to hand work over',
} as const;
