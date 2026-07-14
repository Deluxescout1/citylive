/* ========================= CityLive — default settings =========================
 * In the desktop app you don't need to edit this file — open the menu
 * (CityLive ▸ Settings / Birthdays, or press Ctrl/Cmd + ,) to set your birthdays,
 * location and speed. Those are saved separately and KEPT when the app updates.
 * This file is just the built-in default (and IS replaced by updates).
 * ================================================================================= */
window.CITYLIVE_CFG = {

  /* 1) BIRTHDAYS — on each day a banner, fireworks and floating hearts appear.
   *    Add one entry per person:  { m: MONTH(1-12), d: DAY, label: "MESSAGE" }
   *    Labels use CAPITAL letters, numbers, spaces and hyphens only (no ' & or .).
   *    Add  pink: true  for a pink banner. Leave the list empty [ ] for no birthdays. */
  birthdays: [
    // { m: 6,  d: 15, label: "HAPPY BIRTHDAY ALEX" },
    // { m: 3,  d: 2,  label: "HAPPY BIRTHDAY MOM", pink: true },
  ],

  /* 2) YOUR LOCATION — drives the sun, moon, sunrise/sunset and daylight.
   *    Find your latitude/longitude (e.g. right-click your spot in Google Maps)
   *    and uncomment these two lines. Defaults to Norwich, CT if left off. */
  // lat: 40.7128,
  // lon: -74.0060,

  /* 3) SPEED — how fast the city lives out a full lifetime (village -> metropolis
   *    -> the occasional disaster -> rebuild).
   *      "weekly" = one lifetime per week (normal, relaxing)
   *      "test"   = one lifetime per hour (fast, to see everything quickly) */
  cycle: "weekly",

};
