(function () {
  "use strict";

  var state = {
    view: "dashboard",
    provinces: [], // [{id, name, history: [...]}]
    nationalHistory: [],
    selectedProvinceId: null,
    loading: true,
    loadError: null,
  };

  var charts = {}; // keep Chart.js instances so we can destroy before re-render

  var appEl = document.getElementById("app");
  var tabsEl = document.getElementById("tabs");

  tabsEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".tab");
    if (!btn) return;
    setView(btn.getAttribute("data-view"));
  });

  function setView(view, provinceId) {
    state.view = view;
    state.selectedProvinceId = provinceId || null;
    Array.prototype.forEach.call(tabsEl.querySelectorAll(".tab"), function (t) {
      t.classList.toggle("active", t.getAttribute("data-view") === view);
    });
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function fmtNum(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Math.round(n).toLocaleString();
  }

  function fmtPct(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return n.toFixed(digits === undefined ? 2 : digits) + "%";
  }

  function fmtDate(d) {
    if (!d) return "—";
    try {
      return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return d;
    }
  }

  function latestOf(provinceData) {
    return provinceData && provinceData.history && provinceData.history.length
      ? provinceData.history[0]
      : null;
  }

  function findProvinceMeta(id) {
    return window.PROVINCES.find(function (p) {
      return p.id === id;
    });
  }

  function getProvinceRecord(id) {
    return state.provinces.find(function (p) {
      return p.id === id;
    });
  }

  async function loadData() {
    state.loading = true;
    state.loadError = null;
    render();
    try {
      var res = await fetch("/api/entries");
      if (!res.ok) throw new Error("Server returned " + res.status);
      var data = await res.json();
      state.provinces = data.provinces || [];
      state.nationalHistory = data.nationalHistory || [];
      state.loading = false;
    } catch (err) {
      state.loading = false;
      state.loadError = err.message || "Could not load data.";
    }
    render();
  }

  function render() {
    if (state.loading) {
      appEl.innerHTML = '<div class="loading">Loading province data…</div>';
      return;
    }
    if (state.loadError) {
      appEl.innerHTML =
        '<div class="alert error">Could not load data: ' +
        escapeHtml(state.loadError) +
        ' — <button class="link" id="retry-btn">Try again</button></div>';
      document.getElementById("retry-btn").addEventListener("click", loadData);
      return;
    }

    if (state.view === "entry") {
      renderEntry();
    } else if (state.view === "province") {
      renderProvinceDetail(state.selectedProvinceId);
    } else {
      renderDashboard();
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- Dashboard ----------

  function computeNationalTotals() {
    var totalPop = 0,
      totalChristians = 0,
      totalVillages = 0,
      totalVillagesWithChurches = 0,
      reporting = 0;
    state.provinces.forEach(function (p) {
      var latest = latestOf(p);
      if (latest) {
        reporting++;
        totalPop += latest.population || 0;
        totalChristians += latest.sundayAttendance || 0;
        totalVillages += latest.totalVillages || 0;
        totalVillagesWithChurches += latest.villagesWithChurches || 0;
      }
    });
    return {
      totalPop: totalPop,
      totalChristians: totalChristians,
      totalVillages: totalVillages,
      totalVillagesWithChurches: totalVillagesWithChurches,
      reporting: reporting,
      percentChristian: totalPop > 0 ? (totalChristians / totalPop) * 100 : null,
      percentVillagesWithChurches: totalVillages > 0 ? (totalVillagesWithChurches / totalVillages) * 100 : null,
    };
  }

  function renderDashboard() {
    var totals = computeNationalTotals();
    var goalPct = window.GOAL.targetPercent;
    var progressToGoal = totals.percentChristian !== null ? Math.min(100, (totals.percentChristian / goalPct) * 100) : 0;

    var rows = window.PROVINCES.map(function (meta) {
      var rec = getProvinceRecord(meta.id);
      var latest = rec ? latestOf(rec) : null;
      return { meta: meta, latest: latest };
    });

    rows.sort(function (a, b) {
      var pa = a.latest ? 1 : 0,
        pb = b.latest ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return a.meta.name.localeCompare(b.meta.name);
    });

    var rowsHtml = rows
      .map(function (r) {
        var latest = r.latest;
        var pct = latest && latest.population ? (latest.sundayAttendance / latest.population) * 100 : null;
        var churchPct = latest && latest.totalVillages ? (latest.villagesWithChurches / latest.totalVillages) * 100 : null;
        return (
          '<tr data-province="' +
          r.meta.id +
          '">' +
          "<td>" +
          escapeHtml(r.meta.name) +
          "</td>" +
          '<td class="num">' +
          (latest ? fmtNum(latest.population) : "—") +
          "</td>" +
          '<td class="num">' +
          (latest ? fmtNum(latest.sundayAttendance) : "—") +
          "</td>" +
          '<td class="num">' +
          fmtPct(pct) +
          "</td>" +
          '<td class="num">' +
          (latest ? latest.villagesWithChurches + " / " + latest.totalVillages : "—") +
          " (" +
          fmtPct(churchPct, 0) +
          ")</td>" +
          "<td>" +
          (latest ? fmtDate(latest.date) : "—") +
          "</td>" +
          "<td>" +
          (latest
            ? '<span class="badge reporting">Reporting</span>'
            : '<span class="badge none">No data yet</span>') +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    var yearsLeft = Math.max(0, new Date(window.GOAL.targetDate).getFullYear() - new Date().getFullYear());

    appEl.innerHTML =
      '<div class="hero">' +
      '<div class="hero-eyebrow">Vision · Cambodia</div>' +
      '<h1 class="hero-title">10% of Cambodia following Christ by 2033</h1>' +
      '<p class="hero-sub">Senior pastors in every province report their numbers here so the whole movement can see, together, how close we are to the goal — and where prayer and workers are needed most.</p>' +
      '<div class="hero-figure">' +
      (totals.percentChristian !== null
        ? '<span class="big">' + fmtPct(totals.percentChristian) + '</span><span class="of">reported so far, of a 10% goal &middot; ' + yearsLeft + " years left</span>"
        : '<span class="of">No provinces have reported yet &middot; ' + yearsLeft + " years left to reach the goal</span>") +
      "</div>" +
      "</div>" +
      '<div class="grid stats">' +
      statCard("⛪", "Reporting Provinces", rows.filter(function (r) { return r.latest; }).length + " / " + window.PROVINCES.length, "") +
      statCard("👥", "Total Population Reported", fmtNum(totals.totalPop), "across reporting provinces") +
      statCard("🙏", "Christians Attending Sunday", fmtNum(totals.totalChristians), "self-reported by pastors") +
      statCard("🏘️", "Villages With a Church", (totals.totalVillages ? totals.totalVillagesWithChurches + " / " + totals.totalVillages : "—"), fmtPct(totals.percentVillagesWithChurches, 1) + " of reporting villages") +
      "</div>" +
      '<div class="card goal-card">' +
      '<div class="goal-row"><h3>Progress toward 10% Christian by 2033</h3><span class="goal-pct">' +
      (totals.percentChristian !== null ? fmtPct(totals.percentChristian) : "No data yet") +
      "</span></div>" +
      '<div class="progress-track"><div class="progress-fill" style="width:' +
      progressToGoal +
      '%"></div><div class="progress-target-marker" style="left:100%"></div></div>' +
      '<div class="progress-labels"><span>0%</span><span>Goal: 10% by Jan 2033</span></div>' +
      (totals.percentChristian === null
        ? '<p class="stat-foot" style="margin-top:12px">No provinces have reported yet. Once pastors begin entering data, national progress will appear here.</p>'
        : "") +
      "</div>" +
      '<div class="card" style="margin-top:20px">' +
      '<div class="section-title">National trend vs. goal pace</div>' +
      '<div class="section-sub">Each point is the national total at the time a province submitted a report. The gold line shows the straight-line pace needed to reach 10% by 2033.</div>' +
      '<div class="chart-wrap"><canvas id="national-chart"></canvas></div>' +
      "</div>" +
      '<div class="card" style="margin-top:20px">' +
      '<div class="section-title">By province</div>' +
      '<div class="section-sub">Click a province to see its full reporting history. Data is entered by each province\'s senior pastor.</div>' +
      '<div class="table-wrap"><table class="provinces"><thead><tr>' +
      "<th>Province</th><th>Population</th><th>Sunday Attendance</th><th>% Christian</th><th>Villages with a Church</th><th>Last Updated</th><th>Status</th>" +
      "</tr></thead><tbody>" +
      rowsHtml +
      "</tbody></table></div>" +
      "</div>";

    Array.prototype.forEach.call(appEl.querySelectorAll("tr[data-province]"), function (tr) {
      tr.addEventListener("click", function () {
        setView("province", tr.getAttribute("data-province"));
      });
    });

    renderNationalChart();
  }

  function statCard(icon, label, value, foot) {
    return (
      '<div class="card stat-card"><div class="stat-icon">' +
      icon +
      '</div><div class="stat-label">' +
      escapeHtml(label) +
      '</div><div class="stat-value">' +
      value +
      '</div><div class="stat-foot">' +
      escapeHtml(foot || "") +
      "</div></div>"
    );
  }

  function showChartFallback(canvas) {
    if (!canvas) return;
    var wrap = canvas.closest(".chart-wrap");
    if (wrap) wrap.innerHTML = '<p class="muted" style="padding-top:40px;text-align:center">Chart could not load (no internet connection to the chart library). The numbers above are still accurate.</p>';
  }

  function renderNationalChart() {
    var canvas = document.getElementById("national-chart");
    if (!canvas) return;
    if (!window.Chart) {
      showChartFallback(canvas);
      return;
    }
    if (charts.national) charts.national.destroy();

    var history = state.nationalHistory.slice();
    var labels = history.map(function (h) {
      return fmtDate(h.date);
    });
    var actual = history.map(function (h) {
      return h.percentChristian;
    });

    var targetLabel = "Jan 2033";
    labels.push(targetLabel);
    actual.push(null);

    var goalLine = new Array(labels.length).fill(null);
    if (history.length) {
      goalLine[0] = history[0].percentChristian;
      goalLine[goalLine.length - 1] = window.GOAL.targetPercent;
    } else {
      goalLine[0] = 0;
      goalLine[goalLine.length - 1] = window.GOAL.targetPercent;
      labels.unshift("Today");
      actual.unshift(null);
      goalLine.unshift(0);
    }

    charts.national = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Actual % Christian (reported)",
            data: actual,
            borderColor: "#1f7a6c",
            backgroundColor: "rgba(31,122,108,0.12)",
            fill: true,
            tension: 0.25,
            spanGaps: true,
            pointRadius: 3,
          },
          {
            label: "Pace needed for 10% by 2033",
            data: goalLine,
            borderColor: "#c99a3b",
            borderDash: [6, 4],
            spanGaps: true,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: 11,
            ticks: { callback: function (v) { return v + "%"; } },
          },
        },
      },
    });
  }

  // ---------- Province detail ----------

  function renderProvinceDetail(id) {
    var meta = findProvinceMeta(id);
    if (!meta) {
      setView("dashboard");
      return;
    }
    var rec = getProvinceRecord(id);
    var history = rec && rec.history ? rec.history : [];
    var latest = history[0] || null;

    var pct = latest && latest.population ? (latest.sundayAttendance / latest.population) * 100 : null;
    var churchPct = latest && latest.totalVillages ? (latest.villagesWithChurches / latest.totalVillages) * 100 : null;

    var historyRows = history
      .map(function (h) {
        var p = h.population ? (h.sundayAttendance / h.population) * 100 : null;
        return (
          "<tr><td>" +
          fmtDate(h.date) +
          "</td><td>" +
          escapeHtml(h.enteredBy || "—") +
          '</td><td class="num">' +
          fmtNum(h.population) +
          '</td><td class="num">' +
          h.villagesWithChurches +
          " / " +
          h.totalVillages +
          '</td><td class="num">' +
          fmtNum(h.sundayAttendance) +
          '</td><td class="num">' +
          fmtPct(p) +
          "</td></tr>"
        );
      })
      .join("");

    appEl.innerHTML =
      '<div class="back-link"><button class="link" id="back-to-dash">&larr; Back to dashboard</button></div>' +
      '<div class="grid stats">' +
      statCard("👥", "Population", latest ? fmtNum(latest.population) : "—", latest ? "as of " + fmtDate(latest.date) : "No reports yet") +
      statCard("🙏", "Sunday Attendance", latest ? fmtNum(latest.sundayAttendance) : "—", fmtPct(pct)) +
      statCard("🏘️", "Villages with a Church", latest ? latest.villagesWithChurches + " / " + latest.totalVillages : "—", fmtPct(churchPct, 0)) +
      statCard("📋", "Reports Submitted", history.length, history.length ? "most recent: " + fmtDate(latest.date) : "") +
      "</div>" +
      '<div class="two-panel" style="margin-top:20px">' +
      '<div class="card">' +
      '<div class="section-title">' +
      escapeHtml(meta.name) +
      " — reporting history</div>" +
      (history.length
        ? '<div class="table-wrap"><table class="provinces history-table"><thead><tr><th>Date</th><th>Entered By</th><th>Population</th><th>Villages w/ Church</th><th>Sunday Attendance</th><th>% Christian</th></tr></thead><tbody>' +
          historyRows +
          "</tbody></table></div>"
        : '<p class="muted">No data has been submitted for this province yet.</p>') +
      "</div>" +
      '<div class="card">' +
      '<div class="section-title">Latest report notes</div>' +
      renderExtraDetails(latest) +
      "</div>" +
      "</div>" +
      (history.length
        ? '<div class="card" style="margin-top:20px"><div class="section-title">% Christian over time</div><div class="chart-wrap small"><canvas id="province-chart"></canvas></div></div>'
        : "") +
      '<div style="margin-top:20px"><button class="primary" id="enter-for-province">Enter a new report for ' +
      escapeHtml(meta.name) +
      "</button></div>";

    document.getElementById("back-to-dash").addEventListener("click", function () {
      setView("dashboard");
    });
    document.getElementById("enter-for-province").addEventListener("click", function () {
      setView("entry", id);
    });

    if (history.length) renderProvinceChart(history);
  }

  function renderExtraDetails(latest) {
    if (!latest) return '<p class="muted">—</p>';
    var items = [
      ["Churches", latest.churches],
      ["Baptisms (past year)", latest.baptisms],
      ["New believers (past year)", latest.newBelievers],
      ["Small groups / house churches", latest.smallGroups],
      ["Trained local leaders", latest.trainedLeaders],
    ].filter(function (i) {
      return i[1] !== null && i[1] !== undefined;
    });
    var html = "";
    if (items.length) {
      html +=
        "<dl>" +
        items
          .map(function (i) {
            return "<dt style=\"font-weight:600;color:var(--navy)\">" + i[0] + "</dt><dd style=\"margin:0 0 8px\">" + fmtNum(i[1]) + "</dd>";
          })
          .join("") +
        "</dl>";
    }
    if (latest.notes) {
      html += '<p style="margin-top:8px"><strong>Notes:</strong> ' + escapeHtml(latest.notes) + "</p>";
    }
    if (!items.length && !latest.notes) html = '<p class="muted">No additional details were reported.</p>';
    return html;
  }

  function renderProvinceChart(history) {
    var canvas = document.getElementById("province-chart");
    if (!canvas) return;
    if (!window.Chart) {
      showChartFallback(canvas);
      return;
    }
    if (charts.province) charts.province.destroy();

    var ordered = history.slice().reverse();
    var labels = ordered.map(function (h) {
      return fmtDate(h.date);
    });
    var data = ordered.map(function (h) {
      return h.population ? (h.sundayAttendance / h.population) * 100 : null;
    });

    charts.province = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "% Christian",
            data: data,
            borderColor: "#1f7a6c",
            backgroundColor: "rgba(31,122,108,0.12)",
            fill: true,
            tension: 0.25,
            pointRadius: 3,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return v + "%"; } } } },
      },
    });
  }

  // ---------- Entry form ----------

  var REMEMBER_NAME_KEY = "cambodia-tracker:enteredBy";
  var REMEMBER_PASSCODE_KEY = "cambodia-tracker:passcode";

  function remembered(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (e) {
      return "";
    }
  }

  function remember(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* ignore */
    }
  }

  function renderEntry() {
    var preselect = state.selectedProvinceId || "";
    var options = window.PROVINCES.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === preselect ? " selected" : "") + ">" + escapeHtml(p.name) + "</option>";
    }).join("");

    var today = new Date().toISOString().slice(0, 10);
    var rememberedName = remembered(REMEMBER_NAME_KEY);
    var rememberedPasscode = remembered(REMEMBER_PASSCODE_KEY);

    appEl.innerHTML =
      '<div class="card">' +
      '<div class="section-title">Enter Province Report</div>' +
      '<div class="section-sub">To be completed by the senior pastor (or designated leader) for a province. Submit a new report any time your numbers change — it only takes a minute, and each submission is saved to that province\'s history.</div>' +
      '<form class="entry-form" id="entry-form" autocomplete="off">' +
      '<div class="form-section">' +
      '<div class="form-section-head"><span class="num-badge">1</span><h4>Where and when</h4></div>' +
      '<div class="form-row"><label for="f-province">Province</label>' +
      '<select id="f-province" required><option value="" disabled ' +
      (preselect ? "" : "selected") +
      '>Select a province…</option>' +
      options +
      "</select></div>" +
      '<div class="two-col">' +
      '<div class="form-row"><label for="f-date">Report date</label><input type="date" id="f-date" value="' +
      today +
      '" required></div>' +
      '<div class="form-row"><label for="f-name">Entered by <span class="hint">(pastor / leader name)</span></label><input type="text" id="f-name" placeholder="e.g. Pastor Sok Dara" value="' +
      escapeHtml(rememberedName) +
      '"></div>' +
      "</div>" +
      "</div>" +
      '<div class="form-section">' +
      '<div class="form-section-head"><span class="num-badge">2</span><h4>Population &amp; villages</h4></div>' +
      '<div class="form-row"><label for="f-population">Total population of province</label>' +
      '<input type="number" inputmode="numeric" id="f-population" min="0" step="1" required placeholder="e.g. 850000">' +
      '<div class="ref-note" id="population-ref-note"></div>' +
      "</div>" +
      '<div class="form-row"><label for="f-villages">Total villages in province</label><input type="number" inputmode="numeric" id="f-villages" min="0" step="1" required placeholder="e.g. 450"></div>' +
      '<div class="form-row"><label for="f-churches-villages">Villages with at least one church</label><input type="number" inputmode="numeric" id="f-churches-villages" min="0" step="1" required placeholder="e.g. 120"><div class="field-feedback" id="church-feedback"></div></div>' +
      "</div>" +
      '<div class="form-section">' +
      '<div class="form-section-head"><span class="num-badge">3</span><h4>This Sunday</h4></div>' +
      '<div class="form-row"><label for="f-attendance">Christians attending church this Sunday</label><input type="number" inputmode="numeric" id="f-attendance" min="0" step="1" required placeholder="e.g. 18000"><div class="field-feedback" id="attendance-feedback"></div></div>' +
      "</div>" +
      '<button type="button" class="details-toggle" id="toggle-extra">+ Add optional details (churches, baptisms, new believers, leaders, notes)</button>' +
      '<div class="extra-fields" id="extra-fields">' +
      '<div class="two-col">' +
      '<div class="form-row"><label for="f-num-churches">Total number of churches <span class="hint">(may be more than villages with a church)</span></label><input type="number" inputmode="numeric" id="f-num-churches" min="0" step="1"></div>' +
      '<div class="form-row"><label for="f-leaders">Trained / ordained local leaders</label><input type="number" inputmode="numeric" id="f-leaders" min="0" step="1"></div>' +
      "</div>" +
      '<div class="two-col">' +
      '<div class="form-row"><label for="f-baptisms">Baptisms in the past year</label><input type="number" inputmode="numeric" id="f-baptisms" min="0" step="1"></div>' +
      '<div class="form-row"><label for="f-new-believers">New believers in the past year</label><input type="number" inputmode="numeric" id="f-new-believers" min="0" step="1"></div>' +
      "</div>" +
      '<div class="form-row"><label for="f-small-groups">Small groups / house churches / cell groups</label><input type="number" inputmode="numeric" id="f-small-groups" min="0" step="1"></div>' +
      '<div class="form-row"><label for="f-notes">Notes or prayer requests</label><textarea id="f-notes" rows="3" placeholder="Anything the national team should know — needs, breakthroughs, prayer requests…"></textarea></div>' +
      "</div>" +
      '<div class="form-row"><label for="f-passcode">Team passcode</label><input type="password" id="f-passcode" required placeholder="Provided by your regional coordinator" value="' +
      escapeHtml(rememberedPasscode) +
      '"><span class="hint">Saved on this device so you won\'t need to retype it next time.</span></div>' +
      '<div id="entry-alert"></div>' +
      '<button type="submit" class="primary" id="submit-btn">Submit report</button>' +
      "</form>" +
      "</div>";

    document.getElementById("toggle-extra").addEventListener("click", function () {
      var el = document.getElementById("extra-fields");
      var open = el.classList.toggle("open");
      this.textContent = (open ? "− Hide" : "+ Add") + " optional details (churches, baptisms, new believers, leaders, notes)";
    });

    var provinceSelect = document.getElementById("f-province");
    var populationInput = document.getElementById("f-population");
    var villagesInput = document.getElementById("f-villages");
    var churchVillagesInput = document.getElementById("f-churches-villages");
    var attendanceInput = document.getElementById("f-attendance");

    function applyReferencePopulation() {
      var meta = findProvinceMeta(provinceSelect.value);
      var note = document.getElementById("population-ref-note");
      if (!meta) {
        note.innerHTML = "";
        return;
      }
      if (!populationInput.value) {
        populationInput.value = meta.referencePopulation;
        updateAttendanceFeedback();
      }
      note.innerHTML =
        "Reference: " +
        fmtNum(meta.referencePopulation) +
        " (" +
        escapeHtml(window.POPULATION_SOURCE.label) +
        ') — <button type="button" class="link" id="use-ref-pop">use this number</button> if you don\'t have a more accurate local count.';
      var btn = document.getElementById("use-ref-pop");
      if (btn) {
        btn.addEventListener("click", function () {
          populationInput.value = meta.referencePopulation;
          updateAttendanceFeedback();
        });
      }
    }

    function updateAttendanceFeedback() {
      var pop = Number(populationInput.value);
      var att = Number(attendanceInput.value);
      var el = document.getElementById("attendance-feedback");
      if (!pop || !att) {
        el.textContent = "";
        return;
      }
      var pct = (att / pop) * 100;
      el.textContent = "= " + fmtPct(pct) + " of the province's population";
      el.classList.toggle("warn", att > pop);
    }

    function updateChurchFeedback() {
      var villages = Number(villagesInput.value);
      var withChurch = Number(churchVillagesInput.value);
      var el = document.getElementById("church-feedback");
      if (!villages || !withChurch) {
        el.textContent = "";
        return;
      }
      el.textContent = "= " + fmtPct((withChurch / villages) * 100, 0) + " of villages have a church";
      el.classList.toggle("warn", withChurch > villages);
    }

    provinceSelect.addEventListener("change", applyReferencePopulation);
    populationInput.addEventListener("input", updateAttendanceFeedback);
    attendanceInput.addEventListener("input", updateAttendanceFeedback);
    villagesInput.addEventListener("input", updateChurchFeedback);
    churchVillagesInput.addEventListener("input", updateChurchFeedback);

    if (preselect) applyReferencePopulation();

    document.getElementById("entry-form").addEventListener("submit", onSubmitEntry);
  }

  async function onSubmitEntry(e) {
    e.preventDefault();
    var alertEl = document.getElementById("entry-alert");
    var submitBtn = document.getElementById("submit-btn");
    alertEl.innerHTML = "";

    var provinceId = document.getElementById("f-province").value;
    var meta = findProvinceMeta(provinceId);
    if (!meta) {
      alertEl.innerHTML = '<div class="alert error">Please select a province.</div>';
      return;
    }

    var population = Number(document.getElementById("f-population").value);
    var totalVillages = Number(document.getElementById("f-villages").value);
    var villagesWithChurches = Number(document.getElementById("f-churches-villages").value);
    var sundayAttendance = Number(document.getElementById("f-attendance").value);

    if (villagesWithChurches > totalVillages) {
      alertEl.innerHTML = '<div class="alert error">Villages with a church can\'t be more than total villages. Please check your numbers.</div>';
      return;
    }
    if (sundayAttendance > population) {
      alertEl.innerHTML = '<div class="alert error">Sunday attendance can\'t be more than the total population. Please check your numbers.</div>';
      return;
    }

    var payload = {
      provinceId: provinceId,
      provinceName: meta.name,
      date: document.getElementById("f-date").value,
      enteredBy: document.getElementById("f-name").value.trim(),
      population: population,
      totalVillages: totalVillages,
      villagesWithChurches: villagesWithChurches,
      sundayAttendance: sundayAttendance,
      churches: emptyToNull(document.getElementById("f-num-churches").value),
      trainedLeaders: emptyToNull(document.getElementById("f-leaders").value),
      baptisms: emptyToNull(document.getElementById("f-baptisms").value),
      newBelievers: emptyToNull(document.getElementById("f-new-believers").value),
      smallGroups: emptyToNull(document.getElementById("f-small-groups").value),
      notes: document.getElementById("f-notes").value.trim(),
      passcode: document.getElementById("f-passcode").value,
      submittedAt: new Date().toISOString(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {
      var res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      var body = await res.json();
      if (!res.ok) throw new Error(body.error || "Something went wrong.");

      alertEl.innerHTML = '<div class="alert success">Report saved for ' + escapeHtml(meta.name) + ". Thank you!</div>";
      remember(REMEMBER_NAME_KEY, payload.enteredBy);
      remember(REMEMBER_PASSCODE_KEY, payload.passcode);
      await loadData();
      setTimeout(function () {
        setView("province", provinceId);
      }, 900);
    } catch (err) {
      alertEl.innerHTML = '<div class="alert error">' + escapeHtml(err.message) + "</div>";
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit report";
    }
  }

  function emptyToNull(v) {
    return v === "" || v === null || v === undefined ? null : Number(v);
  }

  loadData();
})();
