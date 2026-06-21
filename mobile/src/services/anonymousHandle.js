// Anonymous handle generator for Profile, Settings, and streak-share cards.

export const generateAnonUsername = () => {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `ascender_${n}`;
};
