// Bode-Fano 判据计算器
// ---------------------------------------------------------------------------
// 数学约定（等纹波理想匹配，带宽以 Hz 表示）：
//   Bode-Fano 准则： ∫₀^∞ ln(1/|Γ(ω)|) dω ≤ K
//   对 RC 负载 K = π/(R C)；对 RL 负载 K = π R / L。（串联/并联拓扑常数相同，
//   因为决定带宽下限的是负载的储能/耗能时间常数，即 Q。）
//   若在带宽 Δω 内 |Γ| 恒为 Γm、带外全反射，则：
//        Δω · ln(1/Γm) ≤ K
//   =>  Γ_min = exp( -K / Δω ),   Δω_max = K / ln(1/Γ)
//   以 Δf 表示（Δω = 2πΔf）：
//        RC:  Γ_min = exp( -1 / (2·R·C·Δf) )
//        RL:  Γ_min = exp( -R / (2·L·Δf) )
// ---------------------------------------------------------------------------

const C_UNITS = { fF: 1e-15, pF: 1e-12, nF: 1e-9, uF: 1e-6 };
const L_UNITS = { pH: 1e-12, nH: 1e-9, uH: 1e-6, mH: 1e-3 };
const F_UNITS = { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 };

const state = {
  lang: "zh",
  loadType: "parallelRC", // parallelRC | seriesRC | parallelRL | seriesRL
  mode: "gamma", // gamma = 给定带宽算 Γmin ; bw = 给定 Γ 算带宽
};

const I18N = {
  zh: {
    "nav.title": "Bode-Fano 计算器",
    "intro": "Bode-Fano 判据给出：任何无耗匹配网络都无法在任意带宽内把有耗电抗负载匹配到完美。本工具计算给定负载在指定带宽下可达到的最小反射系数，或给定反射系数下的最大带宽。",
    "load.heading": "负载类型",
    "load.parallelRC": "并联 RC",
    "load.seriesRC": "串联 RC",
    "load.parallelRL": "并联 RL",
    "load.seriesRL": "串联 RL",
    "load.r": "电阻 R",
    "load.cap": "电容 C",
    "load.ind": "电感 L",
    "load.z0": "参考阻抗 Z0",
    "mode.heading": "计算方向",
    "mode.gamma": "给定带宽 → Γ_min",
    "mode.bw": "给定 Γ → 最大带宽",
    "mode.bandwidth": "带宽 Δf",
    "mode.gammaTarget": "目标反射系数 |Γ|",
    "result.title": "结果",
    "result.gammaMin": "最小反射系数 Γ_min",
    "result.gammaMinDb": "回波损耗（-20log10Γ）",
    "result.vswr": "对应 VSWR",
    "result.bwMax": "最大带宽 Δf_max",
    "result.q": "负载 Q（时间常数×ω）",
    "result.givenBw": "给定带宽",
    "result.givenGamma": "给定 Γ",
    "chart.title": "反射系数下限 vs 带宽",
    "chart.desc": "固定负载，横轴带宽、纵轴可达到的最小反射系数（对数）。红线为当前所选带宽对应的结果。",
    "formula.title": "使用的公式与约定",
    "bad.input": "请输入有效的正数。",
    "bad.gamma": "反射系数需在 0 与 1 之间（不含）。",
    "footer.license": "© 妙妙小工具 · Bode-Fano 计算器",
    "footer.home": "工具集首页",
  },
  en: {
    "nav.title": "Bode-Fano Calculator",
    "intro": "The Bode-Fano criterion states that no lossless matching network can perfectly match a lossy reactive load over arbitrary bandwidth. This tool computes the minimum achievable reflection coefficient for a given bandwidth, or the maximum bandwidth for a given reflection coefficient.",
    "load.heading": "Load Type",
    "load.parallelRC": "Parallel RC",
    "load.seriesRC": "Series RC",
    "load.parallelRL": "Parallel RL",
    "load.seriesRL": "Series RL",
    "load.r": "Resistance R",
    "load.cap": "Capacitance C",
    "load.ind": "Inductance L",
    "load.z0": "Reference Z0",
    "mode.heading": "Direction",
    "mode.gamma": "Given BW → Γ_min",
    "mode.bw": "Given Γ → max BW",
    "mode.bandwidth": "Bandwidth Δf",
    "mode.gammaTarget": "Target reflection |Γ|",
    "result.title": "Results",
    "result.gammaMin": "Minimum reflection Γ_min",
    "result.gammaMinDb": "Return loss (−20log10Γ)",
    "result.vswr": "Corresponding VSWR",
    "result.bwMax": "Maximum bandwidth Δf_max",
    "result.q": "Load Q (time-constant × ω)",
    "result.givenBw": "Given bandwidth",
    "result.givenGamma": "Given Γ",
    "chart.title": "Γ_min vs Bandwidth",
    "chart.desc": "For the fixed load: x = bandwidth, y = achievable minimum reflection (log). The red line marks the current bandwidth result.",
    "formula.title": "Formulas & conventions",
    "bad.input": "Please enter valid positive numbers.",
    "bad.gamma": "Reflection coefficient must be between 0 and 1 (exclusive).",
    "footer.license": "© Miaomiao Tools · Bode-Fano Calculator",
    "footer.home": "Tools Home",
  },
};

const t = (k) => (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k;

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n"));
  });
}

// ---- 数值格式化 ----
function fmt(x, digits = 3) {
  if (!isFinite(x)) return "∞";
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1e4 || a < 1e-3) return x.toExponential(2).replace("e+", "e");
  return Number(x.toPrecision(digits)).toString();
}
function fmtFreq(hz) {
  if (!isFinite(hz)) return "∞";
  if (hz >= 1e9) return fmt(hz / 1e9) + " GHz";
  if (hz >= 1e6) return fmt(hz / 1e6) + " MHz";
  if (hz >= 1e3) return fmt(hz / 1e3) + " kHz";
  return fmt(hz) + " Hz";
}
function gammaToVswr(g) {
  if (g >= 1) return Infinity;
  return (1 + g) / (1 - g);
}

// ---- 核心 Bode-Fano ----
// 返回 K（∫ln(1/|Γ|)dω 的上限常数，rad/s 单位），用于后续换算
function bodeFanoK(loadType, R, X /** X = C 或 L 的 SI 值 */) {
  if (loadType === "parallelRC" || loadType === "seriesRC") {
    // K = π/(R C)  =>  以 Δf:  ln(1/Γ) = 1/(2 R C Δf)
    return { family: "RC", K: Math.PI / (R * X), lnTerm: 1 / (2 * R * X) };
  } else {
    // RL: K = π R / L  =>  以 Δf:  ln(1/Γ) = R/(2 L Δf)
    return { family: "RL", K: (Math.PI * R) / X, lnTerm: R / (2 * X) };
  }
}

// 给定带宽 Δf(Hz) → Γ_min
function gammaMinForBandwidth(bf, dfHz) {
  // Δω·ln(1/Γ) ≤ K  =>  ln(1/Γ) ≤ K/Δω = lnTerm / Δf
  // Γ_min = exp( -lnTerm / Δf )
  return Math.exp((-bf.lnTerm) / dfHz);
}

// 给定 Γ → Δω_max = K / ln(1/Γ) → Δf_max
function bandwidthForGamma(bf, gamma) {
  const lnInv = Math.log(1 / gamma);
  // Δf_max = lnTerm / ln(1/Γ)
  return bf.lnTerm / lnInv;
}

// ---- 读数 ----
function readInputs() {
  const R = parseFloat(document.getElementById("in-r").value);
  const Xraw = parseFloat(document.getElementById("in-x").value);
  const z0 = parseFloat(document.getElementById("in-z0").value) || 50;
  const isRC = state.loadType.endsWith("RC");
  const xUnitTable = isRC ? C_UNITS : L_UNITS;
  const xUnit = document.getElementById("in-x-unit").value;
  const X = Xraw * (xUnitTable[xUnit] ?? 1);
  const bwRaw = parseFloat(document.getElementById("in-bw").value);
  const bwUnit = document.getElementById("in-bw-unit").value;
  const bwHz = bwRaw * (F_UNITS[bwUnit] ?? 1);
  const gammaIn = parseFloat(document.getElementById("in-gamma").value);
  return { R, X, z0, bwHz, gammaIn, isRC };
}

function compute() {
  const { R, X, z0, bwHz, gammaIn } = readInputs();
  const grid = document.getElementById("out-grid");
  const note = document.getElementById("out-note");

  if (!(R > 0) || !(X > 0)) {
    grid.innerHTML = "";
    note.textContent = t("bad.input");
    drawChart(null);
    return;
  }
  const bf = bodeFanoK(state.loadType, R, X);

  let gammaMin, bwMax, markingBwHz;
  if (state.mode === "gamma") {
    if (!(bwHz > 0)) {
      grid.innerHTML = "";
      note.textContent = t("bad.input");
      drawChart(null);
      return;
    }
    gammaMin = gammaMinForBandwidth(bf, bwHz);
    bwMax = bandwidthForGamma(bf, Math.max(gammaMin, 1e-9));
    markingBwHz = bwHz;
  } else {
    if (!(gammaIn > 0) || !(gammaIn < 1)) {
      grid.innerHTML = "";
      note.textContent = t("bad.gamma");
      drawChart(null);
      return;
    }
    bwMax = bandwidthForGamma(bf, gammaIn);
    gammaMin = gammaIn;
    markingBwHz = bwMax;
  }

  const rl = -20 * Math.log10(gammaMin);
  const vswr = gammaToVswr(gammaMin);
  // 负载 Q（在高频近似下）：RC: Q=ωRC；RL: Q=ωL/R —— 这里给单位角频率的“时间常数×ω”，即归一 Q 常数
  const qConst = bf.family === "RC" ? R * X : X / R; // 秒；Q = ω·qConst

  const items = [
    { k: t("result.gammaMin"), v: fmt(gammaMin, 4), primary: true },
    { k: t("result.gammaMinDb"), v: fmt(rl, 4) + " dB" },
    { k: t("result.vswr"), v: isFinite(vswr) ? fmt(vswr, 4) : "∞" },
    { k: t("result.bwMax"), v: fmtFreq(bwMax), primary: state.mode === "bw" },
    { k: state.mode === "gamma" ? t("result.givenBw") : t("result.givenGamma"), v: state.mode === "gamma" ? fmtFreq(bwHz) : fmt(gammaIn, 4) },
    { k: t("result.q"), v: fmt(qConst, 4) + " s" },
  ];
  grid.innerHTML = items
    .map((it) => `<div class="big-item${it.primary ? " primary" : ""}"><div class="k">${it.k}</div><div class="v">${it.v}</div></div>`)
    .join("");
  note.textContent = "";

  drawChart({ bf, markingBwHz });
  renderFormula(bf);
}

// ---- 曲线：横轴带宽（对数），纵轴 Γ_min（对数） ----
function drawChart(ctx) {
  const host = document.getElementById("chart-host");
  const W = Math.max(host.clientWidth || 560, 320);
  const H = 300;
  const pad = { l: 54, r: 16, t: 16, b: 40 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  host.innerHTML = "";
  if (!ctx) return;

  const { bf, markingBwHz } = ctx;
  // 带宽范围：从 mark/10^2 到 mark*10^2（至少跨 4 个数量级）
  const center = markingBwHz > 0 ? markingBwHz : 1e6;
  const fMin = center / 1e2;
  const fMax = center * 1e2;

  const gMin = 1e-3; // 纵轴下界
  const gMax = 1;    // 纵轴上界
  const xOf = (f) => pad.l + ((Math.log10(f) - Math.log10(fMin)) / (Math.log10(fMax) - Math.log10(fMin))) * iw;
  const yOf = (g) => pad.t + ih - ((Math.log10(Math.max(g, gMin)) - Math.log10(gMin)) / (Math.log10(gMax) - Math.log10(gMin))) * ih;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  const el = (n, a) => { const e = document.createElementNS(svgNS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };

  svg.appendChild(el("rect", { x: 0, y: 0, width: W, height: H, fill: "#fff" }));

  // 网格：横轴每 10 倍一条
  const decades = Math.round(Math.log10(fMax) - Math.log10(fMin));
  for (let i = 0; i <= decades; i++) {
    const f = fMin * Math.pow(10, i);
    const x = xOf(f);
    svg.appendChild(el("line", { x1: x, y1: pad.t, x2: x, y2: pad.t + ih, stroke: "#e3ede9" }));
    const tx = el("text", { x, y: H - pad.b + 16, "font-size": "10", "text-anchor": "middle", fill: "#48594f" });
    tx.textContent = fmtFreq(f);
    svg.appendChild(tx);
  }
  // 纵轴：Γ = 1, 0.3, 0.1, 0.03, 0.01 ...
  const gTicks = [1, 0.3, 0.1, 0.03, 0.01, 0.003, 0.001];
  for (const g of gTicks) {
    if (g > gMax || g < gMin - 1e-9) continue;
    const y = yOf(g);
    svg.appendChild(el("line", { x1: pad.l, y1: y, x2: pad.l + iw, y2: y, stroke: "#e3ede9" }));
    const tx = el("text", { x: pad.l - 6, y: y + 4, "font-size": "10", "text-anchor": "end", fill: "#48594f" });
    tx.textContent = fmt(g, 2);
    svg.appendChild(tx);
  }

  // 曲线样本
  let d = "";
  const N = 200;
  for (let i = 0; i <= N; i++) {
    const f = fMin * Math.pow(10, (i / N) * (Math.log10(fMax) - Math.log10(fMin)));
    const g = gammaMinForBandwidth(bf, f);
    const x = xOf(f);
    const y = yOf(g);
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
  }
  svg.appendChild(el("path", { d, fill: "none", stroke: "#1f6feb", "stroke-width": 2 }));

  // 标记线：当前带宽
  if (markingBwHz >= fMin && markingBwHz <= fMax) {
    const x = xOf(markingBwHz);
    svg.appendChild(el("line", { x1: x, y1: pad.t, x2: x, y2: pad.t + ih, stroke: "#e04747", "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
    const gmark = gammaMinForBandwidth(bf, markingBwHz);
    svg.appendChild(el("circle", { cx: x, cy: yOf(gmark), r: 4, fill: "#e04747" }));
    const lbl = el("text", { x: x + 6, y: pad.t + 12, "font-size": "10", fill: "#c02a2a" });
    lbl.textContent = "Γ=" + fmt(gmark, 3);
    svg.appendChild(lbl);
  }

  // 轴标题
  const xl = el("text", { x: pad.l + iw / 2, y: H - 4, "font-size": "11", "text-anchor": "middle", fill: "#48594f" });
  xl.textContent = "Δf (" + (state.lang === "zh" ? "带宽" : "bandwidth") + ")";
  svg.appendChild(xl);
  const yl = el("text", { x: 12, y: pad.t + ih / 2, "font-size": "11", "text-anchor": "middle", fill: "#48594f", transform: `rotate(-90 12 ${pad.t + ih / 2})` });
  yl.textContent = "Γ_min";
  svg.appendChild(yl);

  host.appendChild(svg);
}

// ---- 公式说明 ----
function renderFormula(bf) {
  const body = document.getElementById("formula-body");
  const fam = bf.family;
  const zh = state.lang === "zh";
  if (fam === "RC") {
    body.innerHTML = zh
      ? `对 <b>RC</b> 负载（串联或并联），Bode-Fano 准则：<br>
         <code>∫₀^∞ ln(1/|Γ(ω)|) dω ≤ π/(R·C)</code><br>
         理想等纹波匹配、带宽 Δf 内 |Γ|≈Γ_min：<br>
         <code>Γ_min = exp( −1 / (2·R·C·Δf) )</code><br>
         <code>Δf_max = 1 / (2·R·C·ln(1/Γ))</code><br>
         <span style="color:#8a5a00">注：决定带宽下限的是负载时间常数 R·C；串联与并联拓扑结果相同。</span>`
      : `For an <b>RC</b> load (series or parallel), the Bode-Fano criterion:<br>
         <code>∫₀^∞ ln(1/|Γ(ω)|) dω ≤ π/(R·C)</code><br>
         Ideal equal-ripple match with |Γ|≈Γ_min over bandwidth Δf:<br>
         <code>Γ_min = exp( −1 / (2·R·C·Δf) )</code><br>
         <code>Δf_max = 1 / (2·R·C·ln(1/Γ))</code><br>
         <span style="color:#8a5a00">Note: the RC time constant sets the bandwidth limit; series and parallel give the same result.</span>`;
  } else {
    body.innerHTML = zh
      ? `对 <b>RL</b> 负载（串联或并联），Bode-Fano 准则：<br>
         <code>∫₀^∞ ln(1/|Γ(ω)|) dω ≤ π·R/L</code><br>
         理想等纹波匹配、带宽 Δf 内 |Γ|≈Γ_min：<br>
         <code>Γ_min = exp( −R / (2·L·Δf) )</code><br>
         <code>Δf_max = R / (2·L·ln(1/Γ))</code><br>
         <span style="color:#8a5a00">注：决定带宽下限的是负载时间常数 L/R；串联与并联拓扑结果相同。</span>`
      : `For an <b>RL</b> load (series or parallel), the Bode-Fano criterion:<br>
         <code>∫₀^∞ ln(1/|Γ(ω)|) dω ≤ π·R/L</code><br>
         Ideal equal-ripple match with |Γ|≈Γ_min over bandwidth Δf:<br>
         <code>Γ_min = exp( −R / (2·L·Δf) )</code><br>
         <code>Δf_max = R / (2·L·ln(1/Γ))</code><br>
         <span style="color:#8a5a00">Note: the L/R time constant sets the bandwidth limit; series and parallel give the same result.</span>`;
  }
}

// ---- 交互 ----
function bindSegmented(id, key) {
  const cont = document.getElementById(id);
  cont.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    cont.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (key === "loadType") {
      state.loadType = btn.dataset.type;
      updateLoadUI();
    } else {
      state.mode = btn.dataset.mode;
      updateModeUI();
    }
    compute();
  });
}

function updateLoadUI() {
  const isRC = state.loadType.endsWith("RC");
  document.getElementById("label-reactance").textContent = isRC ? t("load.cap") : t("load.ind");
  const sel = document.getElementById("in-x-unit");
  const opts = isRC ? C_UNITS : L_UNITS;
  sel.innerHTML = Object.keys(opts).map((u) => `<option value="${u}">${u}</option>`).join("");
  sel.value = isRC ? "pF" : "nH";
}

function updateModeUI() {
  const isGamma = state.mode === "gamma";
  document.getElementById("row-bw").hidden = !isGamma;
  document.getElementById("row-gamma").hidden = isGamma;
}

function init() {
  applyI18n();
  bindSegmented("load-type", "loadType");
  bindSegmented("calc-mode", "mode");
  ["in-r", "in-x", "in-x-unit", "in-z0", "in-bw", "in-bw-unit", "in-gamma"].forEach((id) => {
    const el = document.getElementById(id);
    el && el.addEventListener("input", compute);
    el && el.addEventListener("change", compute);
  });
  document.getElementById("lang-select").addEventListener("change", (e) => {
    state.lang = e.target.value;
    document.getElementById("lang-flag").textContent = e.target.value === "zh" ? "🇨🇳" : "🇺🇸";
    document.documentElement.lang = e.target.value === "zh" ? "zh-CN" : "en";
    applyI18n();
    updateLoadUI();
    updateModeUI();
    compute();
  });
  window.addEventListener("resize", () => {
    clearTimeout(init._rt);
    init._rt = setTimeout(compute, 150);
  });
  updateLoadUI();
  updateModeUI();
  compute();
}

document.addEventListener("DOMContentLoaded", init);
