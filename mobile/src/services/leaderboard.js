// Anonymous handle generator. The original public leaderboard surface
// was removed (global ranking contradicted the "Monk Mode" framing of
// solo, intrinsic discipline) and the follow-up Squad feature was also
// removed (no inviteable user pool — solo users would see an empty
// squad UI and feel lonelier, not motivated). The handle itself is
// still used as the default display name on the Profile screen and
// the streak-share card, so this export survives both prunings.

export const generateAnonUsername = () => {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `monk_${n}`;
};
