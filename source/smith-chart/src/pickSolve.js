// pickSolve.js
// Given: component name, the impedance BEFORE this component Zp (actual ohms),
// the target impedance Zt (actual ohms) that the user clicked on the Smith chart,
// and the frequency (Hz), solve for the component value(s) that transform Zp into Zt.
// For L/C/R components the solution is analytic. For transmission lines / stubs the
// electrical length is found by a fine scan. If an exact hit is impossible (e.g. a
// series resistor cannot change the imaginary part), the closest feasible value is
// returned with `approx: true`.
import { inductorUnits, capacitorUnits, resistorUnits } from "./commonFunctions.js";

const EPS = 1e-9;

function inv(z) {
  const d = z.real * z.real + z.imaginary * z.imaginary;
  if (d < EPS) return { real: 0, imaginary: 0 };
  return { real: z.real / d, imaginary: -z.imaginary / d };
}

// Choose a human-friendly unit for `value` (in base SI units) from `unitTable`,
// preferring a displayed magnitude in [1, 1000).
function pickUnit(value, unitTable, preferred) {
  const entries = Object.entries(unitTable).filter((e) => typeof e[1] === "number");
  let best = null;
  let bestScore = Infinity;
  for (const [unit, scale] of entries) {
    if (scale === 0) continue; // skip length "lambda"/"deg" pseudo-units
    const v = value / scale;
    const av = Math.abs(v);
    if (av < EPS) continue;
    let score;
    if (av >= 1 && av < 1000) score = 0;
    else if (av >= 0.001 && av < 1) score = 1 + Math.log10(1 / av);
    else if (av >= 1000) score = 1 + Math.log10(av / 1000);
    else score = 5 + Math.log10(0.001 / av);
    if (score < bestScore) {
      bestScore = score;
      best = { value: v, unit };
    }
  }
  if (!best) return { value: value / (unitTable[preferred] || 1), unit: preferred };
  return best;
}

function round4(x) {
  return Number(Number(x).toPrecision(4));
}

/**
 * Solve component parameters.
 * @param {string} name component name
 * @param {{real:number, imaginary:number}} zp impedance before the component (ohms)
 * @param {{real:number, imaginary:number}} zt target impedance clicked (ohms)
 * @param {number} frequency Hz
 * @param {object} currentComponent the component object (reads zo/eeff defaults)
 * @returns {object|null} fields to merge into the component, or null if unsolvable
 */
export function solveComponentParams(name, zp, zt, frequency, currentComponent = {}) {
  const w = 2 * Math.PI * frequency;
  if (!isFinite(w) || w <= 0) return null;

  // ---- Series elements: Zt = Zp + Zc  =>  Zc = Zt - Zp ----
  if (name === "seriesInd" || name === "seriesCap" || name === "seriesRes") {
    const zc = { real: zt.real - zp.real, imaginary: zt.imaginary - zp.imaginary };
    if (name === "seriesInd") {
      const L = zc.imaginary / w; // Zc = j w L
      if (!isFinite(L) || L <= 0) return null;
      const picked = pickUnit(L, inductorUnits, "nH");
      return { value: round4(picked.value), unit: picked.unit };
    }
    if (name === "seriesCap") {
      const C = -1 / (w * zc.imaginary); // Zc = -j / (w C)
      if (!isFinite(C) || C <= 0) return null;
      const picked = pickUnit(C, capacitorUnits, "pF");
      return { value: round4(picked.value), unit: picked.unit };
    }
    // seriesRes: Zc = R (imaginary should be ~0)
    const R = zc.real;
    if (!isFinite(R) || R <= 0) return null;
    const picked = pickUnit(R, resistorUnits, "\u03A9");
    const approx = Math.abs(zc.imaginary) > Math.max(1e-3 * Math.abs(R), 1e-6);
    return { value: round4(picked.value), unit: picked.unit, approx };
  }

  // ---- Shunt elements: Yt = Yp + Yc  =>  Yc = Yt - Yp ----
  if (name === "shortedInd" || name === "shortedCap" || name === "shortedRes") {
    const yp = inv(zp);
    const yt = inv(zt);
    const yc = { real: yt.real - yp.real, imaginary: yt.imaginary - yp.imaginary };
    if (name === "shortedInd") {
      const L = -1 / (w * yc.imaginary); // Yc = -j / (w L)
      if (!isFinite(L) || L <= 0) return null;
      const picked = pickUnit(L, inductorUnits, "nH");
      return { value: round4(picked.value), unit: picked.unit };
    }
    if (name === "shortedCap") {
      const C = yc.imaginary / w; // Yc = j w C
      if (!isFinite(C) || C <= 0) return null;
      const picked = pickUnit(C, capacitorUnits, "pF");
      return { value: round4(picked.value), unit: picked.unit };
    }
    // shortedRes: Yc = 1/R
    const R = 1 / yc.real;
    if (!isFinite(R) || R <= 0) return null;
    const picked = pickUnit(R, resistorUnits, "\u03A9");
    const approx = Math.abs(yc.imaginary) > 1e-6;
    return { value: round4(picked.value), unit: picked.unit, approx };
  }

  // ---- Transmission line / stubs ----
  if (name === "transmissionLine") {
    return solveLineLength(zp, zt, frequency, currentComponent, false, false);
  }
  if (name === "stub" || name === "shortedStub") {
    return solveLineLength(zp, zt, frequency, currentComponent, true, name === "shortedStub");
  }

  return null;
}

// Solve electrical length (returned in lambda units) for a transmission line or stub.
function solveLineLength(zp, zt, frequency, comp, isStub, isShortedStub) {
  const zo = Number(comp.zo) || 50;
  const eeff = Number(comp.eeff) || 1;
  const betaFactor = Math.sqrt(eeff);

  const cmul = (a, b) => ({
    real: a.real * b.real - a.imaginary * b.imaginary,
    imaginary: a.real * b.imaginary + a.imaginary * b.real,
  });
  const cadd = (a, b) => ({ real: a.real + b.real, imaginary: a.imaginary + b.imaginary });
  const cdiv = (a, b) => {
    const d = b.real * b.real + b.imaginary * b.imaginary;
    return {
      real: (a.real * b.real + a.imaginary * b.imaginary) / d,
      imaginary: (a.imaginary * b.real - a.real * b.imaginary) / d,
    };
  };
  const J = { real: 0, imaginary: 1 };
  const ZO = { real: zo, imaginary: 0 };

  let best = null;
  const N = 20000;
  for (let i = 1; i <= N; i++) {
    const L = (i / N) * 0.5; // 0 -> 0.5 lambda
    const bl = 2 * Math.PI * L * betaFactor;
    const t = Math.tan(bl);
    const jzo_t = { real: 0, imaginary: zo * t };
    let out;
    if (!isStub) {
      // Zin = Zo * (Zp + j Zo tan(bl)) / (Zo + j Zp tan(bl))
      const num = cadd(zp, jzo_t);
      const den = cadd(ZO, cmul(J, { real: zp.real * t, imaginary: zp.imaginary * t }));
      out = cmul(ZO, cdiv(num, den));
    } else {
      let zstubIm;
      if (isShortedStub) zstubIm = zo * t; // shorted: j Zo tan
      else zstubIm = -zo / t; // open: -j Zo cot
      const zstub = { real: 0, imaginary: zstubIm };
      out = inv(cadd(inv(zp), inv(zstub)));
    }
    const err = (out.real - zt.real) ** 2 + (out.imaginary - zt.imaginary) ** 2;
    if (!best || err < best.err) best = { err, L };
  }
  if (!best) return null;
  return {
    value: round4(best.L),
    unit: "\u03BB",
    approx: best.err > 1e-2 * (zt.real ** 2 + zt.imaginary ** 2 + 1),
  };
}
