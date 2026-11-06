import { isThirdParty } from './isThirdParty.mjs';
import { readPageError } from './readPageError.mjs';

export const connect = async ({ socketUrl }) => {
  const socket = new WebSocket(socketUrl);
  await new Promise((done) => socket.addEventListener('open', done));
  const pending = new Map();
  const errors = [];
  let nextId = 0;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const pageError = readPageError({ message });
    if (pageError !== null) {
      errors.push(pageError);
    }
    if (message.id === undefined || !pending.has(message.id)) {
      return;
    }
    pending.get(message.id)(message);
    pending.delete(message.id);
  });
  const send = (method, params = {}) =>
    new Promise((done) => {
      nextId += 1;
      pending.set(nextId, done);
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.result?.exceptionDetails !== undefined) {
      throw new Error(response.result.exceptionDetails.exception?.description ?? expression);
    }
    return response.result?.result?.value;
  };
  const takeErrors = ({ pageOrigin }) =>
    errors
      .splice(0)
      .filter(({ url }) => !isThirdParty({ url, pageOrigin }))
      .map(({ text }) => text);
  return { send, evaluate, takeErrors, close: () => socket.close() };
};
