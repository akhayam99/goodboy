const isCommandName = (text) => text !== '' && text.indexOf(' ') === -1;

const isAclRefusal = (reason) =>
  reason.length > ACL_HEAD.length + ACL_TAIL.length &&
  reason.slice(0, ACL_HEAD.length) === ACL_HEAD &&
  reason.slice(-ACL_TAIL.length) === ACL_TAIL &&
  isCommandName(reason.slice(ACL_HEAD.length, -ACL_TAIL.length));

const isWindowRefusal = (reason) => {
  const at = reason.indexOf(WINDOW_MARK);
  const name = at > 0 ? reason.slice(0, at) : '';
  return isCommandName(name) && name.indexOf('.') !== -1;
};

const isHostRefusal = (reason) =>
  typeof reason === 'string' && (isAclRefusal(reason) || isWindowRefusal(reason));

const isElement = (target) =>
  target != null && target !== window && typeof target.nodeName === 'string';

window.addEventListener(
  'error',
  (event) => {
    if (isElement(event.target)) {
      return;
    }
    recordError(
      'uncaught',
      () =>
        typeof event.message === 'string' && event.message !== ''
          ? event.message
          : describe(event.error, 0),
      () =>
        typeof event.filename === 'string' && event.filename !== ''
          ? clip(fileOf(event.filename) + ':' + toText(event.lineno), MAX_SOURCE)
          : null,
      () => errorStackOf(event.error),
    );
  },
  true,
);

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (isHostRefusal(reason)) {
    quietly(() => event.preventDefault());
    return;
  }
  recordError(
    'rejection',
    () => 'Unhandled rejection: ' + describe(reason, 0),
    () =>
      reason != null && tagOf.call(reason) === '[object Error]'
        ? sourceOfStack(reason.stack, null)
        : null,
    () => errorStackOf(reason),
  );
});
