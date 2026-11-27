type Params = {
  readonly kind: string;
};

export const genericMaskOf = ({ kind }: Params): string => {
  switch (kind) {
    case 'mergePr':
      return 'merge failed';
    case 'mergeTrain':
      return "couldn't start the train";
    case 'startSession':
      return "couldn't start the session";
    case 'stopTrain':
      return "couldn't stop the train";
    case 'sendChatMessage':
      return "couldn't send the message";
    case 'createChat':
      return "couldn't start the chat";
    case 'queryChatMessages':
      return "couldn't load the chat";
    case 'spawnAgent':
    case 'resolveComment':
      return 'could not spawn agent';
    case 'setContextSlot':
      return 'could not update context';
    case 'advanceStep':
      return 'could not advance workflow';
    case 'spawnWorkflow':
      return 'could not attach workflow';
    case 'send':
      return 'send failed';
    case 'createSessionFromIssue':
      return 'could not create session';
    case 'queryFileDiff':
      return 'could not load file diff';
    case 'queryTranscript':
      return "couldn't load transcript";
    default:
      return 'command failed';
  }
};
