const THIRD_PARTY_URL = /^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/;

const isThirdParty = ({ url }) => url !== undefined && THIRD_PARTY_URL.test(url);

export const readPageError = ({ message }) => {
  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails;
    return isThirdParty({ url: details.url })
      ? null
      : (details.exception?.description ?? 'uncaught exception');
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    const url = message.params.stackTrace?.callFrames[0]?.url;
    return isThirdParty({ url })
      ? null
      : message.params.args.map((arg) => arg.value ?? arg.description).join(' ');
  }
  return null;
};
