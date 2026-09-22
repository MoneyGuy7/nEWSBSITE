// ============================================================
// main.js — view switching + top ticker strip
// ============================================================

(function () {
  const navItems = document.querySelectorAll(".nav-item[data-view]");
  const views = document.querySelectorAll(".view");

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;
      navItems.forEach((b) => b.classList.toggle("active", b === btn));
      views.forEach((v) => v.classList.toggle("active", v.id === `view-${target}`));
      if (target === "games") window.YaktonGames && window.YaktonGames.onShow();
    });
  });
})();

// ---------- ticker strip ----------
(function () {
  const symbols = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "BTC-USD", "ETH-USD", "SPY"];
  const track = document.getElementById("tickerTrack");
  if (!track) return;

  function renderTicker() {
    const items = symbols.map((sym) => {
      const change = window.YaktonStocks.pseudoDailyChange(sym);
      const dir = change >= 0 ? "up" : "down";
      const arrow = change >= 0 ? "▲" : "▼";
      return `<span class="ticker-item"><b>${sym}</b><span class="${dir}">${arrow} ${Math.abs(change).toFixed(2)}%</span></span>`;
    });
    // duplicate the list so the CSS scroll loop is seamless
    track.innerHTML = items.join("") + items.join("");
  }

  // wait for stocks.js to be ready
  if (window.YaktonStocks) {
    renderTicker();
  } else {
    window.addEventListener("yakton-stocks-ready", renderTicker);
  }
})();
