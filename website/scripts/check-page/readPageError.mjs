export const readPageError = ({ message }) => {
  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails;
    return { url: details.url, text: details.exception?.description ?? 'uncaught exception' };
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    return {
      url: message.params.stackTrace?.callFrames[0]?.url,
      text: message.params.args.map((arg) => arg.value ?? arg.description).join(' '),
    };
  }
  return null;
};
