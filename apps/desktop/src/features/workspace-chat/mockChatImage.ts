const INBOX_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">',
  '<rect width="640" height="320" fill="whitesmoke"/>',
  '<rect x="24" y="24" width="592" height="40" rx="6" fill="white"/>',
  '<text x="44" y="50" font-family="sans-serif" font-size="16" fill="dimgray">Inbox, Theo Varga</text>',
  '<rect x="24" y="84" width="592" height="88" rx="6" fill="white"/>',
  '<text x="44" y="116" font-family="sans-serif" font-size="15" fill="black">Your Northwind receipt</text>',
  '<text x="44" y="146" font-family="sans-serif" font-size="13" fill="gray">notify-relay, 09:41:02</text>',
  '<rect x="24" y="192" width="592" height="88" rx="6" fill="white"/>',
  '<text x="44" y="224" font-family="sans-serif" font-size="15" fill="black">Your Northwind receipt</text>',
  '<text x="44" y="254" font-family="sans-serif" font-size="13" fill="gray">notify-relay, 09:41:09</text>',
  '</svg>',
].join('');

export const MOCK_CHAT_IMAGE_NAME = 'two-emails.png';

export const mockChatImageBlob = (): Blob => new Blob([INBOX_SVG], { type: 'image/svg+xml' });
