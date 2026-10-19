// Real-world SLAM comparison: trajectories on one clock, rigidly aligned to a reference (assets/realworld/slam.json).
(function () {
  const svg = document.getElementById("rw-chart"), tip = document.getElementById("rw-tip");
  const rows = document.getElementById("rw-rows"), legend = document.getElementById("rw-legend");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  // validated on the panel surface #171a1b (dataviz validator: all checks pass); fixed order by role
  // Three hues, validated ALL-PAIRS on the panel surface (worst CVD dE 9.4): our depth sources only. The
  // independent metric references are drawn in neutral ink (the yardstick, not a competitor); every other method
  // is grey with its own dash, so identity never rests on colour alone.
  const ROLE = {
    ours: { c: "#d95926", w: 2.4, dash: "" },
    d435: { c: "#199e70", w: 2, dash: "" },
    vo: { c: "#3987e5", w: 1.6, dash: "" },
    stereo_ref: { c: "#f4efe6", w: 2.6, dash: "" },
    rgbd_ref: { c: "#f4efe6", w: 2.6, dash: "" },
    deployed: { c: "#d95926", w: 1.4, dash: "4 3" },            // same depth source as "ours", the gate as deployed
    deployed_d435: { c: "#199e70", w: 1.4, dash: "4 3" },
    baseline: { c: "#8f9894", w: 1.5, dash: "6 3" },
    dr: { c: "#8f9894", w: 1.4, dash: "5 4" },
  };
  const DASH = { droid_mono_rgb: "6 3", vggtslam2_mono_rgb: "2 3", orbslam3_mono_rgb: "1 4", breezyslam_d435depth: "8 2 2 2" };
  const style = t => ({ ...(ROLE[t.role] || ROLE.baseline), ...(t.role === "baseline" && DASH[t.key] ? { dash: DASH[t.key] } : {}) });
  const el = (n, a, parent) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); (parent || svg).appendChild(e); return e; };
  fetch("assets/realworld/slam.json").then(r => r.json()).then(D => {
    const W = 760, H = 560, pad = 28;
    const xs = D.tracks.flatMap(t => t.x), ys = D.tracks.flatMap(t => t.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    // plot x (forward at start) up, y (left) to the left; equal metres on both axes
    const s = Math.min((W - 2 * pad) / (y1 - y0), (H - 2 * pad) / (x1 - x0));
    const cx = (W - s * (y1 - y0)) / 2, cy = (H - s * (x1 - x0)) / 2;
    const P = (x, y) => [cx + s * (y1 - y), cy + s * (x1 - x)];
    // recessive 5 m grid
    const g = el("g", { stroke: "rgba(244,239,230,0.07)", "stroke-width": 1 });
    for (let m = Math.ceil(y0 / 5) * 5; m <= y1; m += 5) { const [a] = P(x0, m); el("line", { x1: a, x2: a, y1: pad / 2, y2: H - pad / 2 }, g); }
    for (let m = Math.ceil(x0 / 5) * 5; m <= x1; m += 5) { const [, b] = P(m, y0); el("line", { x1: pad / 2, x2: W - pad / 2, y1: b, y2: b }, g); }
    const [sbx, sby] = [W - pad - 5 * s, H - pad / 2 - 4];
    el("line", { x1: sbx, x2: W - pad, y1: sby, y2: sby, stroke: "#c4bdb0", "stroke-width": 2 });
    el("text", { x: W - pad, y: sby - 6, "text-anchor": "end", fill: "#c4bdb0", "font-size": 12 }).textContent = "5 m";
    const order = ["dr", "baseline", "deployed_d435", "deployed", "vo", "stereo_ref", "d435", "rgbd_ref", "ours"];
    const tracks = [...D.tracks].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
    const marks = {}, lines = {};
    // the core comparison + every INDEPENDENT method that tracked the drive; degenerate or lost runs start hidden
    const shownByDefault = t => t.coverage >= 0.5 && ["ours", "d435", "rgbd_ref", "deployed"].includes(t.role);
    const visible = {}; tracks.forEach(t => { visible[t.key] = shownByDefault(t); });
    tracks.forEach(t => {
      const st = style(t);
      const pts = t.x.map((x, i) => P(x, t.y[i]).map(v => v.toFixed(1)).join(",")).join(" ");
      lines[t.key] = el("polyline", { points: pts, fill: "none", stroke: st.c, "stroke-width": st.w, "stroke-dasharray": st.dash,
        "stroke-linejoin": "round", "stroke-linecap": "round", opacity: t.role === "dr" ? 0.85 : 1,
        visibility: visible[t.key] ? "visible" : "hidden" });
      marks[t.key] = el("circle", { r: 5, fill: st.c, stroke: "#171a1b", "stroke-width": 2, visibility: "hidden" });
    });
    // start marker
    const rt = D.tracks.find(t => t.key === D.reference) || tracks[0];
    const s0 = P(rt.x[0], rt.y[0]);
    el("circle", { cx: s0[0], cy: s0[1], r: 6, fill: "none", stroke: "#f4efe6", "stroke-width": 2 });
    el("text", { x: s0[0] + 10, y: s0[1] + 4, fill: "#f4efe6", "font-size": 12 }).textContent = "start";
    // legend (always, >= 2 series) + table
    tracks.slice().reverse().forEach(t => {
      const st = style(t);
      const li = document.createElement("button"); li.type = "button"; li.className = "rw-key";
      li.setAttribute("aria-pressed", String(visible[t.key]));
      li.innerHTML = `<svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke="${st.c}" stroke-width="2.5" stroke-dasharray="${st.dash}" stroke-linecap="round"/></svg>`;
      li.appendChild(document.createTextNode(t.label));
      li.addEventListener("click", () => {
        visible[t.key] = !visible[t.key]; li.setAttribute("aria-pressed", String(visible[t.key]));
        lines[t.key].setAttribute("visibility", visible[t.key] ? "visible" : "hidden");
      });
      legend.appendChild(li);
      const tr = document.createElement("tr"); if (t.role === "ours") tr.className = "ours";
      const ref = t.key === D.reference;
      const mono = t.scale_given_by_alignment;   // monocular: no metric scale, so the alignment supplies it
      const partial = t.coverage < 0.5;
      if (partial) tr.className = (tr.className + " partial").trim();
      [t.label + (mono ? " · scale given by alignment" : "") + (partial ? " · partial" : ""),
       Math.round(t.coverage * 100) + " % (" + t.seconds_tracked.toFixed(0) + " s)",
       ref ? "–" : (t.skill >= 0 ? "+" : "") + t.skill.toFixed(2),
       ref ? "reference" : t.rms_m.toFixed(2) + " m", ref ? "–" : t.p90_m.toFixed(2) + " m",
       mono ? "–" : t.path_m.toFixed(1) + " m", mono ? "n/a" : t.path_ratio.toFixed(2)]
        .forEach((c, i) => { const td = document.createElement("td"); td.textContent = c; if (i) td.className = "n"; tr.appendChild(td); });
      rows.appendChild(tr);
    });
    // time-linked hover: nearest point on any track -> every track's position at that time
    const T = tracks[0].t;
    const hit = el("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" });
    const at = (t, time) => { let i = 0; while (i < t.t.length - 1 && t.t[i] < time) i++; return i; };
    function show(ev) {
      const r = svg.getBoundingClientRect(), mx = (ev.clientX - r.left) * W / r.width, my = (ev.clientY - r.top) * H / r.height;
      let best = null;
      tracks.filter(t => visible[t.key]).forEach(t => t.x.forEach((x, i) => { const [px, py] = P(x, t.y[i]); const d = (px - mx) ** 2 + (py - my) ** 2; if (!best || d < best.d) best = { d, time: t.t[i], t }; }));
      if (!best || best.d > 900) { hide(); return; }
      tracks.forEach(t => { if (!visible[t.key]) { marks[t.key].setAttribute("visibility", "hidden"); return; } const i = at(t, best.time); const [px, py] = P(t.x[i], t.y[i]); marks[t.key].setAttribute("cx", px); marks[t.key].setAttribute("cy", py); marks[t.key].setAttribute("visibility", "visible"); });
      tip.textContent = `t = ${best.time.toFixed(1)} s · nearest: ${best.t.label} · dots show every method at the same instant`;
    }
    function hide() { Object.values(marks).forEach(m => m.setAttribute("visibility", "hidden")); tip.textContent = "Hover a track: dots mark every method's position at that same moment."; }
    hit.addEventListener("mousemove", show); hit.addEventListener("mouseleave", hide);
    hit.addEventListener("touchmove", e => { show(e.touches[0]); e.preventDefault(); }, { passive: false });
    document.getElementById("rw-meta").textContent =
      `${D.seconds.toFixed(0)} s of driving, ${D.ref_path_m.toFixed(0)} m along the reference path. All tracks rigidly aligned (rotation + translation, no scale) to the reference.`;
  });
})();
