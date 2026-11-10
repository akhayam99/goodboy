type PasskeyBannerText = {
  readonly title: string;
  readonly body: string;
  readonly open: string;
  readonly dismiss: string;
  readonly region: string;
};

type Params = {
  readonly host: string;
};

export const passkeyBannerText = ({ host }: Params): PasskeyBannerText => ({
  title: "Passkeys do not work in Goodboy's browser",
  body: 'Finish this sign-in in your browser, or choose another way on the page, such as a password or a code.',
  open: 'Open in your browser',
  dismiss: 'Dismiss',
  region: host === '' ? 'Passkey step' : `Passkey step on ${host}`,
});
