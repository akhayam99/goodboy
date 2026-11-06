export const createMascot = ({ className, mascotBase64 }) =>
  `<i class="${className}" style="-webkit-mask: url(data:image/png;base64,${mascotBase64}) no-repeat center / contain"></i>`;
