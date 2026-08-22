let lastDeepLinkUrl = null;

export const setLastDeepLinkUrl = (url) => {
  lastDeepLinkUrl = url || null;
};

export const getLastDeepLinkUrl = () => lastDeepLinkUrl;
