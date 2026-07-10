// Shared minimal SVG line chart — used by the weight chart and per-exercise
// strength charts. Points are { x: "YYYY-MM-DD", y: number }, x-axis is
// time-proportional (not just index-spaced).

const DAY_MS = 86_400_000;

export function niceTicks(min, max) {
  for (const step of [0.5, 1, 2, 5, 10, 20, 50]) {
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const count = Math.round((hi - lo) / step);
    if (count <= 5) {
      const ticks = [];
      for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
      return ticks;
    }
  }
  return [min, max];
}

// opts: { width, height, formatY(v), formatXShort(dateStr), selectedX, ariaLabel }
export function lineChartSvg(points, opts = {}) {
  const { width: W = 343, height: H = 190, formatY = String, formatXShort = String, selectedX = null, ariaLabel = "Graf" } = opts;
  const pad = { l: 38, r: 12, t: 10, b: 24 };
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (max - min < 1) { min -= 0.5; max += 0.5; }
  const ticks = niceTicks(min, max);
  min = ticks[0];
  max = ticks[ticks.length - 1];

  const t0 = Date.parse(points[0].x);
  const t1 = Date.parse(points[points.length - 1].x);
  const spanMs = Math.max(t1 - t0, DAY_MS);
  const x = (p) => pad.l + ((Date.parse(p.x) - t0) / spanMs) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);

  const grid = ticks.map((v) => `
    <line x1="${pad.l}" y1="${y(v)}" x2="${W - pad.r}" y2="${y(v)}" class="chart-grid"/>
    <text x="${pad.l - 6}" y="${y(v) + 3}" class="chart-tick" text-anchor="end">${formatY(v)}</text>`).join("");

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");

  const dots = points.map((p) => {
    const isLast = p === points[points.length - 1];
    const isSelected = p.x === selectedX;
    return `
      <circle cx="${x(p).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="${isLast || isSelected ? 4.5 : 2.5}"
        class="chart-dot${isLast ? " last" : ""}${isSelected ? " selected" : ""}" data-x="${p.x}"/>`;
  }).join("");

  const xLabels = points.length > 1 ? `
    <text x="${pad.l}" y="${H - 8}" class="chart-tick" text-anchor="start">${formatXShort(points[0].x)}</text>
    <text x="${W - pad.r}" y="${H - 8}" class="chart-tick" text-anchor="end">${formatXShort(points[points.length - 1].x)}</text>` : "";

  return `
    <svg viewBox="0 0 ${W} ${H}" class="line-chart" role="img" aria-label="${ariaLabel}">
      ${grid}
      <path d="${path}" class="chart-line"/>
      ${dots}
      ${xLabels}
    </svg>`;
}
