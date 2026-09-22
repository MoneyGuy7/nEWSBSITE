// ============================================================
// stocks.js — search, live quotes, canvas chart with a hover
// crosshair, and a localStorage-backed watchlist.
//
// DATA SOURCES, in the order Yakton tries them:
//   1. Twelve Data  — only if you paste a free key below. Best quality:
//      real intraday bars, so 1D/1W ranges are meaningful.
//   2. Stooq        — no key needed, used automatically. Real end-of-day
//      prices (delayed), so short ranges fall back to daily bars.
//   3. Demo data    — only if both real sources fail (offline, an
//      unknown symbol, or a network/CORS hiccup) so the chart never
//      just breaks.
// The quote card always says which source you're looking at.
// ============================================================

const TWELVE_DATA_API_KEY = ""; // optional — paste a free Twelve Data key here for intraday data

const KNOWN_NAMES = {
  AAPL: "Apple Inc.", MSFT: "Microsoft Corp.", NVDA: "NVIDIA Corp.",
  TSLA: "Tesla Inc.", AMZN: "Amazon.com Inc.", GOOGL: "Alphabet Inc.",
  META: "Meta Platforms Inc.", NFLX: "Netflix Inc.", AMD: "Advanced Micro Devices",
  SPY: "SPDR S&P 500 ETF", "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum",
  DIS: "The Walt Disney Co.", KO: "Coca-Cola Co.", NKE: "Nike Inc.",
};
const POPULAR = ["AAPL", "TSLA", "NVDA", "AMZN", "MSFT", "GOOGL", "META", "BTC-USD"];

const RANGE_DAYS = { "1D": 1, "1W": 7, "1M": 30, "3M": 90, "1Y": 365 };

let state = {
  symbol: "AAPL",
  range: "1M",
  series: [],
  quote: null,
};

// ---------- deterministic pseudo-random data (demo mode) ----------
function seededRandom(seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  return function () {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function generateDemoSeries(symbol, days) {
  const rand = seededRandom(symbol + "|" + days);
  const basePrice = 40 + (seededRandom(symbol)() * 460); // $40–$500 range, stable per symbol
  const points = Math.max(days, 20);
  let price = basePrice;
  const series = [];
  const now = new Date();
  for (let i = points; i >= 0; i--) {
    const drift = (rand() - 0.485) * (basePrice * 0.018);
    price = Math.max(1, price + drift);
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    series.push({ date: d, price: Number(price.toFixed(2)) });
  }
  return series;
}

function pseudoDailyChange(symbol) {
  const series = generateDemoSeries(symbol, 2);
  const a = series[series.length - 2].price;
  const b = series[series.length - 1].price;
  return ((b - a) / a) * 100;
}

function demoQuote(symbol) {
  const series = generateDemoSeries(symbol, RANGE_DAYS[state.range]);
  const last = series[series.length - 1].price;
  const prev = series[series.length - 2].price;
  const high = Math.max(...series.slice(-20).map((p) => p.price));
  const low = Math.min(...series.slice(-20).map((p) => p.price));
  return {
    symbol,
    name: KNOWN_NAMES[symbol] || `${symbol} (demo)`,
    price: last,
    change: last - prev,
    changePct: ((last - prev) / prev) * 100,
    open: series[Math.max(0, series.length - 2)].price,
    high, low,
    prevClose: prev,
    series,
    source: "demo",
  };
}

// ---------- live data (Twelve Data) ----------
async function liveQuote(symbol) {
  const days = RANGE_DAYS[state.range];
  const interval = days <= 1 ? "15min" : days <= 7 ? "1h" : "1day";
  const outputsize = days <= 1 ? 32 : days <= 7 ? 56 : Math.min(days, 300);

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVE_DATA_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === "error" || !data.values) throw new Error(data.message || "No data for that symbol");

  const series = data.values
    .map((v) => ({ date: new Date(v.datetime), price: Number(v.close) }))
    .reverse();

  const last = series[series.length - 1].price;
  const prev = series.length > 1 ? series[series.length - 2].price : last;
  const high = Math.max(...series.map((p) => p.price));
  const low = Math.min(...series.map((p) => p.price));

  return {
    symbol,
    name: (data.meta && data.meta.symbol) ? symbol : symbol,
    price: last,
    change: last - prev,
    changePct: ((last - prev) / prev) * 100,
    open: series[0].price,
    high, low,
    prevClose: prev,
    series,
  };
}

// ---------- live data (Stooq — no API key required) ----------
function stooqSymbol(symbol) {
  const s = symbol.toLowerCase();
  if (s.includes(".")) return s;                 // already has an exchange suffix
  if (s.includes("-")) return s.replace("-", ""); // e.g. BTC-USD -> btcusd
  return s + ".us";                                // plain US ticker
}

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().toUpperCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i]));
    return row;
  });
}

async function stooqDailyHistory(symbol, days) {
  const sym = stooqSymbol(symbol);
  const res = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d`);
  const text = await res.text();
  if (!text || text.startsWith("<") || /no data/i.test(text)) throw new Error("No history for that symbol");

  const rows = parseCsv(text).filter((r) => r.DATE && r.CLOSE && !isNaN(Number(r.CLOSE)));
  if (!rows.length) throw new Error("No history for that symbol");

  const series = rows.map((r) => ({ date: new Date(r.DATE), price: Number(r.CLOSE) }));
  return series.slice(-Math.max(days, 2));
}

async function stooqQuote(symbol) {
  const days = RANGE_DAYS[state.range];
  const series = await stooqDailyHistory(symbol, days);
  const last = series[series.length - 1].price;
  const prev = series.length > 1 ? series[series.length - 2].price : last;
  const high = Math.max(...series.map((p) => p.price));
  const low = Math.min(...series.map((p) => p.price));

  return {
    symbol,
    name: KNOWN_NAMES[symbol] || symbol,
    price: last,
    change: last - prev,
    changePct: prev ? ((last - prev) / prev) * 100 : 0,
    open: series[0].price,
    high, low,
    prevClose: prev,
    series,
    source: "stooq",
  };
}

// ---------- source waterfall ----------
async function getQuote(symbol) {
  if (TWELVE_DATA_API_KEY.trim()) {
    try {
      const q = await liveQuote(symbol);
      return { ...q, source: "twelvedata" };
    } catch (err) {
      console.warn("Twelve Data failed, trying Stooq:", err.message);
    }
  }
  try {
    return await stooqQuote(symbol);
  } catch (err) {
    console.warn("Stooq failed, falling back to demo data:", err.message);
    return demoQuote(symbol);
  }
}

// ---------- rendering ----------
const els = {};

function fmt(n) {
  return n == null ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderQuote(q) {
  els.qSymbol.textContent = q.symbol;
  els.qName.textContent = q.name;
  els.qPrice.textContent = "$" + fmt(q.price);
  const up = q.change >= 0;
  els.qChange.textContent = `${up ? "+" : ""}${fmt(q.change)} (${up ? "+" : ""}${q.changePct.toFixed(2)}%)`;
  els.qChange.className = "quote-change mono " + (up ? "up" : "down");
  els.mOpen.textContent = "$" + fmt(q.open);
  els.mHigh.textContent = "$" + fmt(q.high);
  els.mLow.textContent = "$" + fmt(q.low);
  els.mPrev.textContent = "$" + fmt(q.prevClose);
  const flags = {
    twelvedata: "Live intraday data from Twelve Data.",
    stooq: "Real end-of-day price from Stooq (delayed, no key required).",
    demo: "Simulated data — couldn't load a real price for this symbol right now.",
  };
  els.dataFlag.textContent = flags[q.source] || flags.demo;
  els.dataFlag.className = "data-flag" + (q.source !== "demo" ? " live" : "");
  updateWatchToggleLabel();
}

function updateWatchToggleLabel() {
  const list = getWatchlist();
  els.watchToggleBtn.textContent = list.includes(state.symbol) ? "✓ Watching" : "+ Watch";
}

// ---------- canvas chart with hover crosshair ----------
function drawChart(series) {
  const canvas = els.chart;
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (!series.length) return;

  const padL = 8, padR = 8, padT = 14, padB = 22;
  const prices = series.map((p) => p.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;

  const xAt = (i) => padL + (i / (series.length - 1)) * (w - padL - padR);
  const yAt = (price) => padT + (1 - (price - min) / range) * (h - padT - padB);

  const up = prices[prices.length - 1] >= prices[0];
  const lineColor = up ? "#6be3ae" : "#ff6b7a";

  // gridlines
  ctx.strokeStyle = "rgba(91,140,255,0.08)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 3; g++) {
    const y = padT + (g / 3) * (h - padT - padB);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
  }

  // gradient fill under line
  const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
  grad.addColorStop(0, up ? "rgba(107,227,174,0.22)" : "rgba(255,107,122,0.22)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.moveTo(xAt(0), yAt(series[0].price));
  series.forEach((p, i) => ctx.lineTo(xAt(i), yAt(p.price)));
  ctx.lineTo(xAt(series.length - 1), h - padB);
  ctx.lineTo(xAt(0), h - padB);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // line
  ctx.beginPath();
  ctx.moveTo(xAt(0), yAt(series[0].price));
  series.forEach((p, i) => ctx.lineTo(xAt(i), yAt(p.price)));
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  // stash geometry for hover handling
  canvas._chartGeo = { series, xAt, yAt, w, h, padT, padB };
}

function bindChartHover() {
  const canvas = els.chart;
  const tooltip = els.tooltip;

  function onMove(evt) {
    const geo = canvas._chartGeo;
    if (!geo) return;
    const rect = canvas.getBoundingClientRect();
    const mx = evt.clientX - rect.left;

    let closest = 0, closestDist = Infinity;
    geo.series.forEach((p, i) => {
      const d = Math.abs(geo.xAt(i) - mx);
      if (d < closestDist) { closestDist = d; closest = i; }
    });

    const point = geo.series[closest];
    const px = geo.xAt(closest);
    const py = geo.yAt(point.price);

    // redraw base chart then crosshair (cheap enough at this data size)
    drawChart(geo.series);
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.strokeStyle = "rgba(234,240,250,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, geo.padT);
    ctx.lineTo(px, geo.h - geo.padB);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#eaf0fa";
    ctx.fill();
    ctx.restore();

    tooltip.style.opacity = "1";
    tooltip.style.left = px + "px";
    tooltip.style.top = py + "px";
    tooltip.querySelector(".t-price").textContent = "$" + fmt(point.price);
    tooltip.querySelector(".t-date").textContent = point.date.toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      ...(RANGE_DAYS[state.range] <= 1 ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
  }

  function onLeave() {
    tooltip.style.opacity = "0";
    if (canvas._chartGeo) drawChart(canvas._chartGeo.series);
  }

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", onLeave);
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches[0]) onMove(e.touches[0]);
  }, { passive: true });
  canvas.addEventListener("touchend", onLeave);
}

// ---------- watchlist (localStorage) ----------
function getWatchlist() {
  try { return JSON.parse(localStorage.getItem("yakton_watchlist") || "[]"); }
  catch { return []; }
}
function setWatchlist(list) {
  localStorage.setItem("yakton_watchlist", JSON.stringify(list));
}
function renderWatchlist() {
  const list = getWatchlist();
  els.watchlist.innerHTML = "";
  if (!list.length) {
    els.watchlist.innerHTML = '<li class="watchlist-empty">Nothing pinned yet — search a ticker and hit "+ Watch".</li>';
    return;
  }
  list.forEach((sym) => {
    const change = pseudoDailyChangeCache(sym);
    const li = document.createElement("li");
    li.className = "watchlist-item";
    li.innerHTML = `
      <button class="wl-load">
        <span class="wl-sym">${sym}</span>
        <span class="wl-price mono ${change >= 0 ? "up" : "down"}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</span>
      </button>
      <button class="wl-remove" aria-label="Remove ${sym}">×</button>`;
    li.querySelector(".wl-load").addEventListener("click", () => loadSymbol(sym));
    li.querySelector(".wl-remove").addEventListener("click", () => {
      setWatchlist(getWatchlist().filter((s) => s !== sym));
      renderWatchlist();
      updateWatchToggleLabel();
    });
    els.watchlist.appendChild(li);
  });
}

const changeCache = {};
function pseudoDailyChangeCache(sym) {
  if (!(sym in changeCache)) changeCache[sym] = pseudoDailyChange(sym);
  return changeCache[sym];
}

// ---------- symbol loading ----------
async function loadSymbol(symbol) {
  symbol = symbol.trim().toUpperCase();
  if (!symbol) return;
  state.symbol = symbol;
  els.symbolInput.value = symbol;
  els.qSymbol.textContent = symbol;
  els.qPrice.textContent = "…";
  els.dataFlag.textContent = "Loading…";

  const q = await getQuote(symbol);
  state.quote = q;
  state.series = q.series;
  renderQuote(q);
  drawChart(q.series);
}

// ---------- init ----------
function initStocks() {
  els.symbolInput = document.getElementById("symbolInput");
  els.lookupBtn = document.getElementById("lookupBtn");
  els.watchToggleBtn = document.getElementById("watchToggleBtn");
  els.qSymbol = document.getElementById("qSymbol");
  els.qName = document.getElementById("qName");
  els.qPrice = document.getElementById("qPrice");
  els.qChange = document.getElementById("qChange");
  els.mOpen = document.getElementById("mOpen");
  els.mHigh = document.getElementById("mHigh");
  els.mLow = document.getElementById("mLow");
  els.mPrev = document.getElementById("mPrev");
  els.dataFlag = document.getElementById("dataFlag");
  els.chart = document.getElementById("priceChart");
  els.tooltip = document.getElementById("chartTooltip");
  els.watchlist = document.getElementById("watchlist");
  els.popularChips = document.getElementById("popularChips");
  els.rangeRow = document.getElementById("rangeRow");

  els.popularChips.innerHTML = POPULAR.map((s) => `<button class="chip" data-sym="${s}">${s}</button>`).join("");
  els.popularChips.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => loadSymbol(chip.dataset.sym));
  });

  els.lookupBtn.addEventListener("click", () => loadSymbol(els.symbolInput.value));
  els.symbolInput.addEventListener("keydown", (e) => { if (e.key === "Enter") loadSymbol(els.symbolInput.value); });

  els.watchToggleBtn.addEventListener("click", () => {
    const list = getWatchlist();
    if (list.includes(state.symbol)) setWatchlist(list.filter((s) => s !== state.symbol));
    else setWatchlist([...list, state.symbol]);
    renderWatchlist();
    updateWatchToggleLabel();
  });

  els.rangeRow.querySelectorAll(".range-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.rangeRow.querySelectorAll(".range-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.range = btn.dataset.range;
      loadSymbol(state.symbol);
    });
  });

  bindChartHover();
  renderWatchlist();
  loadSymbol(state.symbol);

  window.addEventListener("resize", () => {
    if (state.series.length) drawChart(state.series);
  });
}

document.addEventListener("DOMContentLoaded", initStocks);

// expose a small API for main.js (ticker strip) and other modules
window.YaktonStocks = { pseudoDailyChange: pseudoDailyChangeCache };
window.dispatchEvent(new Event("yakton-stocks-ready"));
