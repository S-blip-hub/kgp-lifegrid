// Command dashboard mock-up. Reads window.LIFEGRID, written by
// `npm run drill` in backend/.
(function () {
  "use strict";

  const D = window.LIFEGRID;
  const M = D.metrics;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const LABEL = {
    MED: "Medical / accident", FGT: "Fight / violence", HAR: "Harassment / threat",
    HAZ: "Fire / electrical hazard", CRS: "Crisis support", UNS: "Unsafe zone report",
  };

  $("subtitle").textContent =
    `${D.config.sessions} drill sessions · ${M.alerts} alerts from ${D.nodes.length} LifeNodes · ` +
    `${M.cases} cases after merging ${M.repeat_presses_merged} repeat presses`;

  // ------------------------------------------------------------ cards vs pilot targets
  const cards = [
    { label: "Transmission success", value: `${M.transmission_success_pct}%`, target: "> 95%", ok: M.transmission_success_pct > 95 },
    { label: "Acknowledged ≤ 60 s", value: `${M.ack_within_60s_pct}%`, target: `median ${M.ack_median_s} s`, ok: M.ack_median_s < 60 },
    { label: "Reached (median)", value: `${Math.round(M.reach_median_s)} s`, target: `P1 90th pct ${Math.round(M.reach_p90_priority1_s)} s`, ok: true },
    { label: "Verified closure", value: `${M.verified_closure_pct}%`, target: "100% in drills", ok: M.verified_closure_pct === 100 },
    { label: "Follow-ups on time", value: `${M.follow_up_on_time_pct}%`, target: `${M.follow_ups} same-day / 24 h / 72 h checks`, ok: M.follow_up_on_time_pct >= 90 },
    { label: "Escalations", value: M.escalations, target: "missed pickups reassigned", ok: true },
    { label: "False alarms", value: `${M.false_alarm_pct}%`, target: "classified after safety", ok: true },
  ];
  $("cards").innerHTML = cards
    .map(
      (c) => `<div class="card"><div class="label">${c.label}</div><div class="value">${c.value}</div>` +
        `<div class="target"><b class="${c.ok ? "ok" : "miss"}">${c.ok ? "✓" : "✗"}</b> ${c.target}</div></div>`,
    )
    .join("");

  // ------------------------------------------------------------ acknowledgement histogram
  const acks = D.cases.filter((c) => c.code !== "UNS" && c.ack !== null).map((c) => c.ack);
  const width = 10;
  const maxBin = 12; // 0-120 s, last bin is "120+"
  const bins = new Array(maxBin + 1).fill(0);
  acks.forEach((a) => (bins[Math.min(maxBin, Math.floor(a / width))] += 1));
  const top = Math.max(...bins);
  $("ack-hist").innerHTML = bins
    .map((n, i) => {
      const from = i * width;
      const label = i === maxBin ? `${from}+ s` : `${from}–${from + width} s`;
      return `<div class="col ${from >= 60 ? "late" : ""}" title="${label}: ${n} cases"><i style="height:${(100 * n) / top}%"></i></div>`;
    })
    .join("");
  $("ack-hist").insertAdjacentHTML("afterend", `<div class="hist-axis"><span>0 s</span><span>60 s</span><span>120 s+</span></div>`);

  // ------------------------------------------------------------ anonymised counts
  const byCat = Object.entries(D.analytics.byCategory).sort((a, b) => b[1] - a[1]);
  const most = byCat[0][1];
  $("by-cat").innerHTML = byCat
    .map(([k, n]) => `<li><span>${LABEL[k]}</span><span class="track"><i style="width:${(100 * n) / most}%"></i></span><span class="n">${n}</span></li>`)
    .join("");

  // ------------------------------------------------------------ case log
  Object.entries(LABEL).forEach(([k, v]) => $("filter").insertAdjacentHTML("beforeend", `<option value="${k}">${v}</option>`));

  function renderRows() {
    const f = $("filter").value;
    $("rows").innerHTML = D.cases
      .filter((c) => !f || c.code === f)
      .map((c) => {
        const fu = c.followUps.length ? `${c.followUps.filter((x) => !x.late).length}/${c.followUps.length} on time` : "–";
        return `<tr data-id="${c.id}"><td>${c.id}</td><td>${esc(c.node)}</td><td>${LABEL[c.code]}${c.silent ? " (silent)" : ""}</td>` +
          `<td class="${c.priority === 1 ? "p1" : ""}">${c.priority}</td><td>${c.ack ?? "–"}</td><td>${c.reach ?? "–"}</td>` +
          `<td>${fu}</td><td>${c.outcome ? `<span class="chip ${c.outcome}">${c.outcome.replace("_", " ")}</span>` : "–"}</td>` +
          `<td><span class="chip ${c.status}">${c.status.replace("_", " ")}</span></td></tr>`;
      })
      .join("");
  }
  $("filter").addEventListener("change", renderRows);
  renderRows();

  const fmtT = (s) => {
    if (s < 120) return `+${Math.round(s)} s`;
    if (s < 7200) return `+${Math.round(s / 60)} min`;
    return `+${(s / 3600).toFixed(1)} h`;
  };

  $("rows").addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const c = D.cases.find((x) => x.id === tr.dataset.id);
    $("detail-title").textContent = `${c.id} · ${LABEL[c.code]} · ${c.node}`;
    $("timeline").innerHTML = c.events
      .map((ev) => `<li class="${ev.type}"><time>${fmtT(ev.t)}</time><b>${ev.type.replace(/_/g, " ")}</b>` +
        `${ev.by ? ` · ${esc(ev.by)}` : ""}${ev.note ? `<br><small>${esc(ev.note)}</small>` : ""}</li>`)
      .join("");
    $("detail").hidden = false;
  });
  $("close").addEventListener("click", () => ($("detail").hidden = true));
})();
