'use strict';
// ============================================================================================
// LOCATION-TRUE ECLIPSES — the real sky, from wherever the viewer actually is.
//
// Nick: "I want to make sure everything like that is also coded in and you see it HOW you'd see it
// based on your Location. So like I would see it different in Norwich than Buffalo or even Houston."
//
// ⚠⚠ THE ONE THING THAT MAKES THIS WORK, AND IT IS EASY TO SKIP: the Moon's PARALLAX. Comparing
// GEOCENTRIC sun and moon positions gives every observer on Earth the same eclipse — you can rewrite
// the whole ephemeris, throw away the hardcoded date table, and still have the original bug. The
// Moon's horizontal parallax is about 1°, roughly TWICE its own diameter, and that displacement is
// precisely why an eclipse is total in one town and invisible three states away. So both bodies are
// converted geocentric -> TOPOCENTRIC for the observer before their separation is measured.
//
// There is no eclipse date table here at all. An eclipse is simply what it is in the sky: the moment
// the topocentric separation of the two discs drops below the sum of their apparent radii. That works
// for every past and future date without anyone maintaining a list.
//
// Positions: Meeus, "Astronomical Algorithms" 2nd ed. — Sun ch.25 (~1"), Moon ch.47 truncated to the
// terms that matter at the arcsecond-to-few-arcsecond level, nutation ch.22, topocentric ch.40,
// lunar-eclipse shadow geometry ch.54.
// ============================================================================================

var DEG = Math.PI / 180;
function rev(x) { x = x % 360; return x < 0 ? x + 360 : x; }
function sind(x) { return Math.sin(x * DEG); }
function cosd(x) { return Math.cos(x * DEG); }

// Julian Ephemeris Day from a JS Date (UTC). ΔT is ignored: it is ~70 s this century, which moves an
// eclipse's clock time by about a minute and its magnitude by far less than this model's own error.
function jdOf(date) { return date.valueOf() / 86400000 + 2440587.5; }

// ---- SUN, geocentric apparent (Meeus 25) ----------------------------------------------------
function sunPos(jd) {
  var T = (jd - 2451545.0) / 36525.0;
  var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  var M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  var e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M)
        + (0.019993 - 0.000101 * T) * sind(2 * M)
        + 0.000289 * sind(3 * M);
  var trueLon = L0 + C, nu = M + C;
  var R = 1.000001018 * (1 - e * e) / (1 + e * cosd(nu));          // AU
  var Om = 125.04 - 1934.136 * T;
  var lam = trueLon - 0.00569 - 0.00478 * sind(Om);                 // apparent longitude
  return { lon: rev(lam), lat: 0, dist: R };
}

// ---- MOON, geocentric (Meeus 47) -------------------------------------------------------------
// Table 47.A — D, M, M', F, Σl coefficient (1e-6 deg), Σr coefficient (1e-3 km)
var LR = [
  [0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],
  [0,0,2,0,213618,-569925],[0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],
  [2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],
  [2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],
  [0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],
  [0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],
  [4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],
  [1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
  [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],
  [0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],
  [1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],
  [0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],
  [2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],
  [3,0,-1,0,-892,3258],[2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],
  [0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],[2,1,-2,0,691,0],
  [2,-1,0,-2,596,0],[4,0,1,0,549,-1423],[0,0,4,0,537,-1117],
  [4,-1,0,0,520,-1571],[1,0,-2,0,-487,-1739],[2,1,0,-2,-399,0],
  [0,0,2,-2,-381,-4421],[1,1,1,0,351,0],[3,0,-2,0,-340,0],
  [4,0,-3,0,330,0],[2,-1,2,0,327,0],[0,2,1,0,-323,1165],
  [1,1,-1,0,299,0],[2,0,3,0,294,0],[2,0,-1,-2,0,8752]
];
// Table 47.B — D, M, M', F, Σb coefficient (1e-6 deg)
var BT = [
  [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],
  [2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],
  [2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],
  [2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],
  [2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],
  [0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],
  [0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],
  [4,0,0,-1,1021],[4,0,-1,1,833],[0,0,1,-3,777],[4,0,-2,1,671],
  [2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],[2,0,-2,1,-451],
  [0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],[2,1,-1,1,-366],
  [2,1,0,1,-351],[4,0,0,1,331],[2,-1,1,1,315],[2,-2,0,-1,302],
  [0,0,1,3,-283],[2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223],
  [0,1,-2,-1,-220],[2,1,-1,-1,-220],[1,0,1,1,-185],[2,-1,-2,-1,181],
  [0,1,2,1,-177],[4,0,-2,-1,176],[4,-1,-1,-1,166],[1,0,1,-1,-164],
  [4,0,1,-1,132],[1,0,-1,-1,-119],[4,-1,0,-1,115],[2,-2,0,1,107]
];
function moonPos(jd) {
  var T = (jd - 2451545.0) / 36525.0, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  var Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  var D  = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
  var M  = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
  var Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
  var F  =  93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
  var A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.290 * T, A3 = 313.45 + 481266.484 * T;
  var E = 1 - 0.002516 * T - 0.0000074 * T2;                    // eccentricity correction on M terms
  var sl = 0, sr = 0, sb = 0, i, t, arg, f;
  for (i = 0; i < LR.length; i++) {
    t = LR[i]; arg = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
    f = (t[1] === 0) ? 1 : (Math.abs(t[1]) === 1 ? E : E * E);
    sl += t[4] * f * sind(arg); sr += t[5] * f * cosd(arg);
  }
  for (i = 0; i < BT.length; i++) {
    t = BT[i]; arg = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
    f = (t[1] === 0) ? 1 : (Math.abs(t[1]) === 1 ? E : E * E);
    sb += t[4] * f * sind(arg);
  }
  sl += 3958 * sind(A1) + 1962 * sind(Lp - F) + 318 * sind(A2);
  sb += -2235 * sind(Lp) + 382 * sind(A3) + 175 * sind(A1 - F) + 175 * sind(A1 + F)
      + 127 * sind(Lp - Mp) - 115 * sind(Lp + Mp);
  return { lon: rev(Lp + sl / 1e6), lat: sb / 1e6, dist: 385000.56 + sr / 1000 };   // km
}

// ---- nutation & obliquity (Meeus 22) ---------------------------------------------------------
function nutation(jd) {
  var T = (jd - 2451545.0) / 36525.0;
  var Om = 125.04452 - 1934.136261 * T;
  var Ls = 280.4665 + 36000.7698 * T, Lm = 218.3165 + 481267.8813 * T;
  var dpsi = (-17.20 * sind(Om) - 1.32 * sind(2 * Ls) - 0.23 * sind(2 * Lm) + 0.21 * sind(2 * Om)) / 3600;
  var deps = (9.20 * cosd(Om) + 0.57 * cosd(2 * Ls) + 0.10 * cosd(2 * Lm) - 0.09 * cosd(2 * Om)) / 3600;
  var e0 = (23 * 3600 + 26 * 60 + 21.448 - 46.8150 * T - 0.00059 * T * T + 0.001813 * T * T * T) / 3600;
  return { dpsi: dpsi, eps: e0 + deps };
}
function eclToEq(lon, lat, eps) {
  var sl = sind(lon), cl = cosd(lon), sb = sind(lat), cb = cosd(lat), se = sind(eps), ce = cosd(eps);
  var ra = Math.atan2(sl * ce - (sb / cb) * se, cl) / DEG;
  var dec = Math.asin(sb * ce + cb * se * sl) / DEG;
  return { ra: rev(ra), dec: dec };
}
// apparent sidereal time at Greenwich, degrees (Meeus 12)
function gast(jd) {
  var T = (jd - 2451545.0) / 36525.0;
  var th = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000;
  var n = nutation(jd);
  return rev(th + n.dpsi * cosd(n.eps));
}

// ---- geocentric -> TOPOCENTRIC (Meeus 40). THE STEP THAT MAKES ECLIPSES LOCAL. ----------------
// Returns topocentric ra/dec plus the topocentric distance ratio q (dist_topo = q * dist_geo).
function topocentric(ra, dec, distKm, jd, lat, lon, elevM) {
  var u = Math.atan(0.99664719 * Math.tan(lat * DEG));
  var h = (elevM || 0) / 6378140;
  var rhoSin = 0.99664719 * Math.sin(u) + h * sind(lat);
  var rhoCos = Math.cos(u) + h * cosd(lat);
  var sinPi = 6378.14 / distKm;                                   // equatorial horizontal parallax
  var H = rev(gast(jd) + lon - ra);                               // local hour angle, degrees
  var A = cosd(dec) * sind(H);
  var B = cosd(dec) * cosd(H) - rhoCos * sinPi;
  var C = sind(dec) - rhoSin * sinPi;
  var q = Math.sqrt(A * A + B * B + C * C);
  var Hp = Math.atan2(A, B) / DEG;
  return { ra: rev(ra + (H - Hp)), dec: Math.asin(C / q) / DEG, q: q, H: Hp };
}

// angular separation of two equatorial positions, in degrees
function sep(ra1, dec1, ra2, dec2) {
  var c = sind(dec1) * sind(dec2) + cosd(dec1) * cosd(dec2) * cosd(ra1 - ra2);
  return Math.acos(Math.max(-1, Math.min(1, c))) / DEG;
}
// altitude of an equatorial position for an observer, degrees
function altitudeOf(ra, dec, jd, lat, lon) {
  var H = rev(gast(jd) + lon - ra);
  return Math.asin(sind(dec) * sind(lat) + cosd(dec) * cosd(lat) * cosd(H)) / DEG;
}

var AU_KM = 149597870.7;

// ============================================================================================
// SOLAR ECLIPSE, as seen from one place at one instant.
// magnitude   — fraction of the Sun's DIAMETER covered (the number astronomers quote)
// obscuration — fraction of the Sun's AREA covered (what the light level actually follows)
// ============================================================================================
function solarEclipse(date, lat, lon, elevM) {
  var jd = jdOf(date);
  var nut = nutation(jd), eps = nut.eps;
  var s = sunPos(jd), m = moonPos(jd);
  var sEq = eclToEq(s.lon, s.lat, eps), mEq = eclToEq(m.lon, m.lat, eps);
  var sKm = s.dist * AU_KM;
  var sT = topocentric(sEq.ra, sEq.dec, sKm, jd, lat, lon, elevM);
  var mT = topocentric(mEq.ra, mEq.dec, m.dist, jd, lat, lon, elevM);
  // apparent radii at the OBSERVER, from each body's topocentric distance
  var rSun = 959.63 / (s.dist * sT.q) / 3600;                     // degrees
  var rMoon = Math.asin(0.272481 * (6378.14 / (m.dist * mT.q))) / DEG;
  var d = sep(sT.ra, sT.dec, mT.ra, mT.dec);
  var alt = altitudeOf(sT.ra, sT.dec, jd, lat, lon);
  var out = { mag: 0, obsc: 0, sepDeg: d, rSun: rSun, rMoon: rMoon, sunAlt: alt,
              total: false, annular: false, visible: false, dx: 0, dy: 0 };
  if (d >= rSun + rMoon) return out;                              // discs do not touch
  out.mag = (rSun + rMoon - d) / (2 * rSun);
  if (d <= Math.abs(rMoon - rSun)) {                              // one disc wholly inside the other
    out.obsc = (rMoon >= rSun) ? 1 : (rMoon * rMoon) / (rSun * rSun);
    out.total = rMoon >= rSun; out.annular = rMoon < rSun;
  } else {
    // area of the lune between two overlapping circles
    var a = rSun, b = rMoon;
    var c1 = Math.acos(Math.max(-1, Math.min(1, (d * d + a * a - b * b) / (2 * d * a))));
    var c2 = Math.acos(Math.max(-1, Math.min(1, (d * d + b * b - a * a) / (2 * d * b))));
    var area = a * a * (c1 - Math.sin(2 * c1) / 2) + b * b * (c2 - Math.sin(2 * c2) / 2);
    out.obsc = area / (Math.PI * a * a);
  }
  // where the Moon sits relative to the Sun, in sky coordinates — so the renderer can slide the dark
  // disc across on the REAL side rather than always left-to-right.
  out.dx = (mT.ra - sT.ra + 540) % 360 - 180;
  out.dx *= cosd(sT.dec);
  out.dy = mT.dec - sT.dec;
  out.visible = out.obsc > 0 && alt > -0.5;                       // below the horizon = not your eclipse
  return out;
}

// ============================================================================================
// LUNAR ECLIPSE. ⚠ A DIFFERENT PROBLEM FROM SOLAR, and worth being honest with Nick about:
// the umbral magnitude is essentially the SAME for everyone on the night side, because the Moon is
// physically inside Earth's shadow. What is local is only WHETHER THE MOON IS UP where you are.
// So Norwich and Houston see the same blood moon; Tokyo sees nothing.
// ============================================================================================
function lunarEclipse(date, lat, lon) {
  var jd = jdOf(date);
  var nut = nutation(jd), eps = nut.eps;
  var s = sunPos(jd), m = moonPos(jd);
  // the shadow axis is the antisolar point
  var axLon = rev(s.lon + 180), axLat = 0;
  var d = sep(0, 0, 0, 0);                                        // placeholder, replaced below
  // separation of the Moon from the shadow axis, in the ecliptic frame
  var dLon = ((m.lon - axLon + 540) % 360 - 180) * cosd(m.lat);
  var dLat = m.lat - axLat;
  d = Math.sqrt(dLon * dLon + dLat * dLat);
  var piM = Math.asin(6378.14 / m.dist) / DEG;                    // Moon's horizontal parallax
  var piS = 8.794 / 3600 / s.dist;                                // Sun's parallax
  var sS = 959.63 / 3600 / s.dist;                                // Sun's semidiameter
  var sM = Math.asin(0.272481 * sind(piM)) / DEG;                 // Moon's semidiameter
  // Earth's shadow at the Moon's distance, with the standard 2% atmospheric enlargement
  var fPen = 1.02 * (0.998340 * piM + piS + sS);
  var fUmb = 1.02 * (0.998340 * piM + piS - sS);
  var mEq = eclToEq(m.lon, m.lat, eps);
  var alt = altitudeOf(mEq.ra, mEq.dec, jd, lat, lon);
  var umbMag = (fUmb + sM - d) / (2 * sM);
  var penMag = (fPen + sM - d) / (2 * sM);
  return {
    umbMag: umbMag, penMag: penMag, sepDeg: d, moonAlt: alt,
    total: umbMag >= 1, partial: umbMag > 0 && umbMag < 1, penumbral: penMag > 0 && umbMag <= 0,
    // ⚠ the ONLY location dependence: is the Moon above this observer's horizon?
    visible: penMag > 0 && alt > -0.5,
    deep: umbMag > 0                                              // in the umbra at all -> reddening
  };
}

module.exports = { sunPos, moonPos, nutation, eclToEq, gast, topocentric, sep, altitudeOf,
                   solarEclipse, lunarEclipse, jdOf };
