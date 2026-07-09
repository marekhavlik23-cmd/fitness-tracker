// Weight view — phase 1 placeholder. Phase 3 adds quick entry, SVG chart and trend.

export function renderWeight(el) {
  el.innerHTML = `
    <h2>Tělesná váha</h2>
    <div class="card placeholder-card">
      <span class="big-emoji">⚖️</span>
      <h3>Sledování váhy</h3>
      <p>Rychlý zápis váhy, graf vývoje a trend<br>přijdou ve fázi 3.</p>
    </div>`;
}
