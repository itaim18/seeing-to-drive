// Project page behaviour: camera/depth slider, accuracy-vs-speed chart + table (from data.json), BibTeX copy.
(function () {
  // ---- compare slider
  const cmp = document.getElementById("compare"), range = document.getElementById("cmp-range");
  if (cmp && range) {
    range.addEventListener("input", () => cmp.style.setProperty("--pos", range.value + "%"));
    document.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll("[data-k]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      document.getElementById("cmp-rgb").src = `assets/media/pair${b.dataset.k}_rgb.jpg`;
      document.getElementById("cmp-dep").src = `assets/media/pair${b.dataset.k}_depth.jpg`;
    }));
  }

  // ---- BibTeX copy
  const copy = document.getElementById("copy");
  if (copy) copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(document.getElementById("bibtex").textContent); copy.textContent = "Copied"; }
    catch (e) { copy.textContent = "Select and copy"; }
    setTimeout(() => (copy.textContent = "Copy"), 1600);
  });

  // ---- chart + table
  const svg = document.getElementById("chart"), tip = document.getElementById("tip"), rows = document.getElementById("rows");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  const el = (n, a, t) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; svg.appendChild(e); return e; };
  const W = 760, H = 380, L = 62, R = 22, T = 20, B = 48;
  const M = {
    absrel_obst: { lab: "AbsRel on obstacle pixels (lower is better)", lo: 0.1, hi: 0.8, inv: false, step: 0.1 },
    absrel_all: { lab: "AbsRel on all pixels (lower is better)", lo: 0.2, hi: 0.6, inv: false, step: 0.05 },
    real_r: { lab: "Pearson r to DAv2-L, real video (higher is better)", lo: 0.68, hi: 1.01, inv: true, step: 0.05 },
  };
  const short = (n) => n.replace(", Hailo Model Zoo", " (zoo)").replace("Ours: distilled student v5 (deployed)", "Ours (v5)")
    .replace("Depth Anything V2-", "DAv2-").replace("Depth Anything 3-", "DA3-");
  const OFF = { "hailo:dav2student_v5_288x512": [12, 18], "hailo:dav2_s_224x392_o0b8r80": [10, 20], "hailo:depth_anything_v2_vits": [8, -14],
                "hailo:scdepthv3": [12, 5], "hailo:fast_depth": [-12, -14] };
  const xs = (f) => L + (Math.log10(f) - Math.log10(12)) / (Math.log10(170) - Math.log10(12)) * (W - L - R);

  fetch("assets/media/data.json").then((r) => r.json()).then((D) => {
    const chip = D.models.filter((m) => m.where === "chip"), gpu = D.models.filter((m) => m.where === "gpu");
    // table
    const row = (m) => {
      const tr = document.createElement("tr"); if (m.k.includes("student")) tr.className = "ours";
      [short(m.name).replace("Ours (v5)", "Ours: student v5 (deployed)"), m.where === "chip" ? "Hailo-8L int8" : "RTX 5090 fp32",
       m.absrel_all.toFixed(3), m.absrel_obst.toFixed(3), m.d1_all.toFixed(3), m.real_r.toFixed(3),
       m.fps ? m.fps.toFixed(1) + " FPS" : (m.gpu_ms ? Math.round(m.gpu_ms) + " ms" : "—")]
        .forEach((c, i) => { const td = document.createElement("td"); td.textContent = c; if (i > 1) td.className = "n"; tr.appendChild(td); });
      return tr;
    };
    chip.forEach((m) => rows.appendChild(row(m)));
    const sep = document.createElement("tr"); sep.className = "sep"; const td = document.createElement("td"); td.colSpan = 7;
    td.textContent = "Float references on the GPU (cannot run on the Pi at this rate)"; sep.appendChild(td); rows.appendChild(sep);
    gpu.forEach((m) => rows.appendChild(row(m)));

    function draw(key) {
      const m = M[key]; while (svg.firstChild) svg.removeChild(svg.firstChild);
      const ys = (v) => T + (m.inv ? (m.hi - v) : (v - m.lo)) / (m.hi - m.lo) * (H - T - B);
      for (let v = Math.ceil(m.lo / m.step) * m.step; v <= m.hi + 1e-9; v += m.step) {
        el("line", { x1: L, x2: W - R, y1: ys(v), y2: ys(v), class: "grid" }); el("text", { x: L - 10, y: ys(v) + 4, "text-anchor": "end" }, v.toFixed(2));
      }
      [15, 20, 30, 50, 100, 150].forEach((f) => { el("line", { x1: xs(f), x2: xs(f), y1: T, y2: H - B, class: "grid" }); el("text", { x: xs(f), y: H - B + 18, "text-anchor": "middle" }, f); });
      el("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, class: "axis" });
      el("text", { x: (L + W - R) / 2, y: H - 8, "text-anchor": "middle" }, "Raspberry Pi 5 + Hailo-8L, frames per second (batch 1, measured, log scale)");
      el("text", { x: 14, y: (T + H - B) / 2, "text-anchor": "middle", transform: `rotate(-90 14 ${(T + H - B) / 2})` }, m.lab);
      gpu.filter((g) => ["dav2_l", "da3_s"].includes(g.k)).forEach((g) => {
        const y = ys(g[key]); el("line", { x1: L, x2: W - R, y1: y, y2: y, class: "ref" });
        el("text", { x: W - R - 4, y: g.k === "da3_s" ? y + 14 : y - 6, "text-anchor": "end", class: "reflab" }, short(g.name) + ", float GPU");
      });
      chip.filter((c) => c.k !== "hailo:dav2student_v3_288x512").forEach((c) => {     // v3 sits under v5
        const x = xs(c.fps), y = ys(c[key]), ours = c.k.includes("student"), o = OFF[c.k] || [8, 4];
        const pt = el("circle", { cx: x, cy: y, r: ours ? 9 : 6.5, class: ours ? "pt ours" : "pt", tabindex: 0 });
        el("text", { x: x + o[0], y: y + o[1], "text-anchor": o[0] < 0 ? "end" : "start", class: ours ? "lab ours" : "lab" }, short(c.name));
        const say = () => (tip.textContent = `${short(c.name)}: ${c[key].toFixed(3)} at ${c.fps.toFixed(1)} FPS on the Hailo-8L` + (c.params ? `, ${c.params} M parameters` : ""));
        pt.addEventListener("mouseenter", say); pt.addEventListener("focus", say);
      });
    }
    const btns = document.querySelectorAll("[data-m]");
    btns.forEach((b) => b.addEventListener("click", () => { btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw(b.dataset.m); }));
    draw("absrel_obst");
  }).catch(() => { tip.textContent = "Chart data could not be loaded."; });
})();
