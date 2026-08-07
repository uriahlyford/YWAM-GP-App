(function () {
  "use strict";

  var t = window.I18N.t;

  var state = {
    view: "dashboard",
    provinces: [], // [{id, name, history: [...]}]
    nationalHistory: [],
    selectedProvinceId: null,
    loading: true,
    loadError: null,
    villageHierarchy: {}, // provinceId -> {districts, villageCount, communeCount, districtCount}
    villageStatus: {}, // provinceId -> { [villageCode]: {hasChurch, note} }
  };

  var charts = {}; // keep Chart.js instances so we can destroy before re-render

  var appEl = document.getElementById("app");
  var tabsEl = document.getElementById("tabs");

  tabsEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".tab");
    if (!btn) return;
    setView(btn.getAttribute("data-view"));
  });

  document.getElementById("lang-toggle").addEventListener("click", function () {
    window.I18N.setLang(window.I18N.getLang() === "km" ? "en" : "km");
  });

  window.I18N.onChange(function () {
    applyStaticTranslations();
    render();
  });

  function applyStaticTranslations() {
    document.getElementById("brand-title").textContent = t("app.title");
    document.getElementById("brand-sub").textContent = t("app.subtitle");
    document.getElementById("tab-dashboard").textContent = t("nav.dashboard");
    document.getElementById("tab-entry").textContent = t("nav.entry");
    document.getElementById("footer-text").textContent = t("footer.text");
    document.title = t("app.title") + " — Cambodia Church Growth Tracker";
    var lang = window.I18N.getLang();
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang-opt]"), function (el) {
      el.classList.toggle("active", el.getAttribute("data-lang-opt") === lang);
    });
  }

  function setView(view, provinceId) {
    state.view = view;
    state.selectedProvinceId = provinceId || null;
    Array.prototype.forEach.call(tabsEl.querySelectorAll(".tab"), function (t) {
      t.classList.toggle("active", t.getAttribute("data-view") === view);
    });
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function villagesHaveChurchLabel(count) {
    return count === 1 ? t("registry.summary.one") : t("registry.summary");
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
      var locale = window.I18N.getLang() === "km" ? "km-KH" : undefined;
      return new Date(d + "T00:00:00").toLocaleDateString(locale, {
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

  function provinceName(meta) {
    if (!meta) return "";
    return window.I18N.getLang() === "km" && meta.nameKhmer ? meta.nameKhmer : meta.name;
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

  async function loadVillageStatus(provinceId) {
    if (state.villageStatus[provinceId]) return state.villageStatus[provinceId];
    try {
      var res = await fetch("/api/villages?province=" + encodeURIComponent(provinceId));
      var data = await res.json();
      state.villageStatus[provinceId] = data.statuses || {};
    } catch (e) {
      state.villageStatus[provinceId] = {};
    }
    return state.villageStatus[provinceId];
  }

  async function loadVillageHierarchy(provinceId) {
    if (state.villageHierarchy[provinceId]) return state.villageHierarchy[provinceId];
    var res = await fetch("/data/villages/" + provinceId + ".json");
    var data = await res.json();
    state.villageHierarchy[provinceId] = data;
    return data;
  }

  function registryChurchCount(provinceId) {
    var status = state.villageStatus[provinceId];
    if (!status) return null;
    var n = 0;
    Object.keys(status).forEach(function (code) {
      if (status[code] && status[code].hasChurch) n++;
    });
    return n;
  }

  function render() {
    if (state.loading) {
      appEl.innerHTML = '<div class="loading">' + escapeHtml(t("loading")) + "</div>";
      return;
    }
    if (state.loadError) {
      appEl.innerHTML =
        '<div class="alert error">' +
        escapeHtml(t("error.loadFailed")) +
        " " +
        escapeHtml(state.loadError) +
        ' — <button class="link" id="retry-btn">' +
        escapeHtml(t("error.retry")) +
        "</button></div>";
      document.getElementById("retry-btn").addEventListener("click", loadData);
      return;
    }

    if (state.view === "entry") {
      renderEntry();
    } else if (state.view === "province") {
      renderProvinceDetail(state.selectedProvinceId);
    } else if (state.view === "registry") {
      renderRegistry(state.selectedProvinceId);
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
    var yearsLeft = Math.max(0, new Date(window.GOAL.targetDate).getFullYear() - new Date().getFullYear());

    var rows = window.PROVINCES.map(function (meta) {
      var rec = getProvinceRecord(meta.id);
      var latest = rec ? latestOf(rec) : null;
      return { meta: meta, latest: latest };
    });

    rows.sort(function (a, b) {
      var pa = a.latest ? 1 : 0,
        pb = b.latest ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return provinceName(a.meta).localeCompare(provinceName(b.meta));
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
          escapeHtml(provinceName(r.meta)) +
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
            ? '<span class="badge reporting">' + escapeHtml(t("badge.reporting")) + "</span>"
            : '<span class="badge none">' + escapeHtml(t("badge.noData")) + "</span>") +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    appEl.innerHTML =
      '<div class="hero">' +
      '<div class="hero-eyebrow">' + escapeHtml(t("hero.eyebrow")) + "</div>" +
      '<h1 class="hero-title">' + escapeHtml(t("hero.title")) + "</h1>" +
      '<p class="hero-sub">' + escapeHtml(t("hero.sub")) + "</p>" +
      '<div class="hero-figure">' +
      (totals.percentChristian !== null
        ? '<span class="big">' + fmtPct(totals.percentChristian) + '</span><span class="of">' + escapeHtml(t("hero.figure.reported")) + " &middot; " + yearsLeft + " " + escapeHtml(t("hero.figure.yearsLeft")) + "</span>"
        : '<span class="of">' + escapeHtml(t("hero.figure.noData")) + " &middot; " + yearsLeft + " " + escapeHtml(t("hero.figure.yearsLeftToGoal")) + "</span>") +
      "</div>" +
      '<div class="pitch-strip">' +
      '<span class="pitch-chip">🌐 ' + escapeHtml(t("pitch.bilingual")) + '</span>' +
      '<span class="pitch-chip">🗺️ ' + escapeHtml(t("pitch.villages")) + '</span>' +
      '<span class="pitch-chip">📡 ' + escapeHtml(t("pitch.together")) + '</span>' +
      "</div>" +
      "</div>" +
      '<div class="grid stats">' +
      statCard("⛪", t("stat.reportingProvinces"), rows.filter(function (r) { return r.latest; }).length + " / " + window.PROVINCES.length, "") +
      statCard("👥", t("stat.totalPopulation"), fmtNum(totals.totalPop), t("stat.totalPopulation.foot")) +
      statCard("🙏", t("stat.attendance"), fmtNum(totals.totalChristians), t("stat.attendance.foot")) +
      statCard("🏘️", t("stat.villagesWithChurch"), (totals.totalVillages ? totals.totalVillagesWithChurches + " / " + totals.totalVillages : "—"), fmtPct(totals.percentVillagesWithChurches, 1) + " " + t("stat.villagesWithChurch.foot")) +
      "</div>" +
      '<div class="card goal-card">' +
      '<div class="goal-row"><h3>' + escapeHtml(t("goal.title")) + '</h3><span class="goal-pct">' +
      (totals.percentChristian !== null ? fmtPct(totals.percentChristian) : escapeHtml(t("goal.noData"))) +
      "</span></div>" +
      '<div class="progress-track"><div class="progress-fill" style="width:' +
      progressToGoal +
      '%"></div><div class="progress-target-marker" style="left:100%"></div></div>' +
      '<div class="progress-labels"><span>' + escapeHtml(t("goal.labelStart")) + '</span><span>' + escapeHtml(t("goal.labelTarget")) + '</span></div>' +
      (totals.percentChristian === null
        ? '<p class="stat-foot" style="margin-top:12px">' + escapeHtml(t("goal.emptyNote")) + "</p>"
        : "") +
      "</div>" +
      '<div class="card" style="margin-top:20px">' +
      '<div class="section-title">' + escapeHtml(t("chart.title")) + '</div>' +
      '<div class="section-sub">' + escapeHtml(t("chart.sub")) + '</div>' +
      '<div class="chart-wrap"><canvas id="national-chart"></canvas></div>' +
      "</div>" +
      '<div class="card" style="margin-top:20px">' +
      '<div class="section-title">' + escapeHtml(t("table.title")) + '</div>' +
      '<div class="section-sub">' + escapeHtml(t("table.sub")) + '</div>' +
      '<div class="table-wrap"><table class="provinces"><thead><tr>' +
      "<th>" + escapeHtml(t("table.province")) + "</th><th>" + escapeHtml(t("table.population")) + "</th><th>" + escapeHtml(t("table.attendance")) + "</th><th>" + escapeHtml(t("table.percentChristian")) + "</th><th>" + escapeHtml(t("table.villagesWithChurch")) + "</th><th>" + escapeHtml(t("table.lastUpdated")) + "</th><th>" + escapeHtml(t("table.status")) + "</th>" +
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
    if (wrap) wrap.innerHTML = '<p class="muted" style="padding-top:40px;text-align:center">' + escapeHtml(t("chart.fallback")) + "</p>";
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

    var targetLabel = t("chart.target2033");
    labels.push(targetLabel);
    actual.push(null);

    var goalLine = new Array(labels.length).fill(null);
    if (history.length) {
      goalLine[0] = history[0].percentChristian;
      goalLine[goalLine.length - 1] = window.GOAL.targetPercent;
    } else {
      goalLine[0] = 0;
      goalLine[goalLine.length - 1] = window.GOAL.targetPercent;
      labels.unshift(t("chart.today"));
      actual.unshift(null);
      goalLine.unshift(0);
    }

    charts.national = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: t("chart.actual"),
            data: actual,
            borderColor: "#1f7a6c",
            backgroundColor: "rgba(31,122,108,0.12)",
            fill: true,
            tension: 0.25,
            spanGaps: true,
            pointRadius: 3,
          },
          {
            label: t("chart.goal"),
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
      '<div class="back-link"><button class="link" id="back-to-dash">&larr; ' + escapeHtml(t("back.dashboard")) + '</button></div>' +
      '<div class="grid stats">' +
      statCard("👥", t("detail.population"), latest ? fmtNum(latest.population) : "—", latest ? t("detail.population.asOf") + " " + fmtDate(latest.date) : t("detail.population.noReports")) +
      statCard("🙏", t("detail.attendance"), latest ? fmtNum(latest.sundayAttendance) : "—", fmtPct(pct)) +
      statCard("🏘️", t("detail.villagesWithChurch"), latest ? latest.villagesWithChurches + " / " + latest.totalVillages : "—", fmtPct(churchPct, 0)) +
      statCard("📋", t("detail.reportsSubmitted"), history.length, history.length ? t("detail.mostRecent") + ": " + fmtDate(latest.date) : "") +
      "</div>" +
      '<div class="two-panel" style="margin-top:20px">' +
      '<div class="card">' +
      '<div class="section-title">' +
      escapeHtml(provinceName(meta)) +
      " — " + escapeHtml(t("detail.historyTitle")) + "</div>" +
      (history.length
        ? '<div class="table-wrap"><table class="provinces history-table"><thead><tr><th>' + escapeHtml(t("detail.col.date")) + '</th><th>' + escapeHtml(t("detail.col.enteredBy")) + '</th><th>' + escapeHtml(t("detail.col.population")) + '</th><th>' + escapeHtml(t("detail.col.villages")) + '</th><th>' + escapeHtml(t("detail.col.attendance")) + '</th><th>' + escapeHtml(t("detail.col.percent")) + '</th></tr></thead><tbody>' +
          historyRows +
          "</tbody></table></div>"
        : '<p class="muted">' + escapeHtml(t("detail.noHistory")) + "</p>") +
      "</div>" +
      '<div class="card">' +
      '<div class="section-title">' + escapeHtml(t("detail.latestNotes")) + '</div>' +
      renderExtraDetails(latest) +
      "</div>" +
      "</div>" +
      (history.length
        ? '<div class="card" style="margin-top:20px"><div class="section-title">' + escapeHtml(t("detail.chartTitle")) + '</div><div class="chart-wrap small"><canvas id="province-chart"></canvas></div></div>'
        : "") +
      '<div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">' +
      '<button class="pill-link" id="enter-for-province">📋 ' + escapeHtml(t("detail.enterNew")) + " " + escapeHtml(provinceName(meta)) + "</button>" +
      '<button class="pill-link secondary" id="open-registry">🗺️ ' + escapeHtml(t("detail.openRegistry")) + " " + escapeHtml(provinceName(meta)) + "</button>" +
      "</div>";

    document.getElementById("back-to-dash").addEventListener("click", function () {
      setView("dashboard");
    });
    document.getElementById("enter-for-province").addEventListener("click", function () {
      setView("entry", id);
    });
    document.getElementById("open-registry").addEventListener("click", function () {
      setView("registry", id);
    });

    if (history.length) renderProvinceChart(history);
  }

  function renderExtraDetails(latest) {
    if (!latest) return '<p class="muted">—</p>';
    var items = [
      [t("detail.extra.churches"), latest.churches],
      [t("detail.extra.baptisms"), latest.baptisms],
      [t("detail.extra.newBelievers"), latest.newBelievers],
      [t("detail.extra.smallGroups"), latest.smallGroups],
      [t("detail.extra.trainedLeaders"), latest.trainedLeaders],
    ].filter(function (i) {
      return i[1] !== null && i[1] !== undefined;
    });
    var html = "";
    if (items.length) {
      html +=
        "<dl>" +
        items
          .map(function (i) {
            return "<dt style=\"font-weight:600;color:var(--navy)\">" + escapeHtml(i[0]) + "</dt><dd style=\"margin:0 0 8px\">" + fmtNum(i[1]) + "</dd>";
          })
          .join("") +
        "</dl>";
    }
    if (latest.notes) {
      html += '<p style="margin-top:8px"><strong>' + escapeHtml(t("detail.notesLabel")) + ':</strong> ' + escapeHtml(latest.notes) + "</p>";
    }
    if (!items.length && !latest.notes) html = '<p class="muted">' + escapeHtml(t("detail.noExtra")) + "</p>";
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
            label: t("detail.chartTitle"),
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

  var REMEMBER_NAME_KEY = "vision2033:enteredBy";
  var REMEMBER_PASSCODE_KEY = "vision2033:passcode";

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
    var options = window.PROVINCES.slice()
      .sort(function (a, b) { return provinceName(a).localeCompare(provinceName(b)); })
      .map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === preselect ? " selected" : "") + ">" + escapeHtml(provinceName(p)) + "</option>";
      })
      .join("");

    var today = new Date().toISOString().slice(0, 10);
    var rememberedName = remembered(REMEMBER_NAME_KEY);
    var rememberedPasscode = remembered(REMEMBER_PASSCODE_KEY);

    appEl.innerHTML =
      '<div class="card">' +
      '<div class="section-title">' + escapeHtml(t("entry.title")) + '</div>' +
      '<div class="section-sub">' + escapeHtml(t("entry.sub")) + '</div>' +
      '<form class="entry-form" id="entry-form" autocomplete="off">' +
      '<div class="form-section">' +
      '<div class="form-section-head"><span class="num-badge">1</span><h4>' + escapeHtml(t("entry.section1")) + '</h4></div>' +
      '<div class="form-row"><label for="f-province">' + escapeHtml(t("entry.province")) + '</label>' +
      '<select id="f-province" required><option value="" disabled ' +
      (preselect ? "" : "selected") +
      ">" + escapeHtml(t("entry.provincePlaceholder")) + "</option>" +
      options +
      "</select></div>" +
      '<div class="two-col">' +
      '<div class="form-row"><label for="f-date">' + escapeHtml(t("entry.date")) + '</label><input type="date" id="f-date" value="' +
      today +
      '" required></div>' +
      '<div class="form-row"><label for="f-name">' + escapeHtml(t("entry.enteredBy")) + ' <span class="hint">' + escapeHtml(t("entry.enteredBy.hint")) + '</span></label><input type="text" id="f-name" placeholder="' + escapeHtml(t("entry.enteredBy.placeholder")) + '" value="' +
      escapeHtml(rememberedName) +
      '"></div>' +
      "</div>" +
      "</div>" +
      '<div class="form-section">' +
      '<div class="form-section-head"><span class="num-badge">2</span><h4>' + escapeHtml(t("entry.section2")) + '</h4></div>' +
      '<div class="form-row"><label for="f-population">' + escapeHtml(t("entry.population")) + '</label>' +
      '<input type="number" inputmode="numeric" id="f-population" min="0" step="1" required placeholder="e.g. 850000">' +
      '<div class="ref-note" id="population-ref-note"></div>' +
      "</div>" +
      '<div class="form-row"><label for="f-villages">' + escapeHtml(t("entry.villages")) + '</label><input type="number" inputmode="numeric" id="f-villages" min="0" step="1" required placeholder="e.g. 450"><div class="ref-note" id="villages-ref-note"></div></div>' +
      '<div class="form-row"><label for="f-churches-villages">' + escapeHtml(t("entry.villagesWithChurch")) + '</label><input type="number" inputmode="numeric" id="f-churches-villages" min="0" step="1" required placeholder="e.g. 120"><div class="field-feedback" id="church-feedback"></div><div class="ref-note" id="registry-sync-note"></div></div>' +
      "</div>" +
      '<div class="form-section">' +
      '<div class="form-section-head"><span class="num-badge">3</span><h4>' + escapeHtml(t("entry.section3")) + '</h4></div>' +
      '<div class="form-row"><label for="f-attendance">' + escapeHtml(t("entry.attendance")) + '</label><input type="number" inputmode="numeric" id="f-attendance" min="0" step="1" required placeholder="e.g. 18000"><div class="field-feedback" id="attendance-feedback"></div></div>' +
      "</div>" +
      '<button type="button" class="details-toggle" id="toggle-extra">' + escapeHtml(t("entry.toggleExtra.show")) + '</button>' +
      '<div class="extra-fields" id="extra-fields">' +
      '<div class="two-col">' +
      '<div class="form-row"><label for="f-num-churches">' + escapeHtml(t("entry.numChurches")) + ' <span class="hint">' + escapeHtml(t("entry.numChurches.hint")) + '</span></label><input type="number" inputmode="numeric" id="f-num-churches" min="0" step="1"></div>' +
      '<div class="form-row"><label for="f-leaders">' + escapeHtml(t("entry.leaders")) + '</label><input type="number" inputmode="numeric" id="f-leaders" min="0" step="1"></div>' +
      "</div>" +
      '<div class="two-col">' +
      '<div class="form-row"><label for="f-baptisms">' + escapeHtml(t("entry.baptisms")) + '</label><input type="number" inputmode="numeric" id="f-baptisms" min="0" step="1"></div>' +
      '<div class="form-row"><label for="f-new-believers">' + escapeHtml(t("entry.newBelievers")) + '</label><input type="number" inputmode="numeric" id="f-new-believers" min="0" step="1"></div>' +
      "</div>" +
      '<div class="form-row"><label for="f-small-groups">' + escapeHtml(t("entry.smallGroups")) + '</label><input type="number" inputmode="numeric" id="f-small-groups" min="0" step="1"></div>' +
      '<div class="form-row"><label for="f-notes">' + escapeHtml(t("entry.notes")) + '</label><textarea id="f-notes" rows="3" placeholder="' + escapeHtml(t("entry.notes.placeholder")) + '"></textarea></div>' +
      "</div>" +
      '<div class="form-row"><label for="f-passcode">' + escapeHtml(t("entry.passcode")) + '</label><input type="password" id="f-passcode" required placeholder="' + escapeHtml(t("entry.passcode.placeholder")) + '" value="' +
      escapeHtml(rememberedPasscode) +
      '"><span class="hint">' + escapeHtml(t("entry.passcode.remembered")) + '</span></div>' +
      '<div id="entry-alert"></div>' +
      '<button type="submit" class="primary" id="submit-btn">' + escapeHtml(t("entry.submit")) + '</button>' +
      "</form>" +
      "</div>";

    document.getElementById("toggle-extra").addEventListener("click", function () {
      var el = document.getElementById("extra-fields");
      var open = el.classList.toggle("open");
      this.textContent = open ? t("entry.toggleExtra.hide") : t("entry.toggleExtra.show");
    });

    var provinceSelect = document.getElementById("f-province");
    var populationInput = document.getElementById("f-population");
    var villagesInput = document.getElementById("f-villages");
    var churchVillagesInput = document.getElementById("f-churches-villages");
    var attendanceInput = document.getElementById("f-attendance");

    function applyReferences() {
      var meta = findProvinceMeta(provinceSelect.value);
      var popNote = document.getElementById("population-ref-note");
      var villNote = document.getElementById("villages-ref-note");
      var syncNote = document.getElementById("registry-sync-note");
      if (!meta) {
        popNote.innerHTML = "";
        villNote.innerHTML = "";
        syncNote.innerHTML = "";
        return;
      }
      if (!populationInput.value) {
        populationInput.value = meta.referencePopulation;
      }
      if (!villagesInput.value) {
        villagesInput.value = meta.referenceVillages;
      }
      updateAttendanceFeedback();
      updateChurchFeedback();

      popNote.innerHTML =
        escapeHtml(t("entry.ref.label")) + " " + fmtNum(meta.referencePopulation) + " (" + escapeHtml(window.POPULATION_SOURCE.label) + ') — <button type="button" class="link" id="use-ref-pop">' + escapeHtml(t("entry.ref.use")) + "</button> " + escapeHtml(t("entry.ref.caveat"));
      var popBtn = document.getElementById("use-ref-pop");
      if (popBtn) {
        popBtn.addEventListener("click", function () {
          populationInput.value = meta.referencePopulation;
          updateAttendanceFeedback();
        });
      }

      villNote.innerHTML =
        escapeHtml(t("entry.ref.label")) + " " + fmtNum(meta.referenceVillages) + " — " + escapeHtml(window.VILLAGE_SOURCE.label) + " (" + escapeHtml(window.VILLAGE_SOURCE.publisher) + "), " + escapeHtml(t("entry.ref.villageNote"));

      loadVillageStatus(meta.id).then(function () {
        var count = registryChurchCount(meta.id);
        if (count !== null && count > 0) {
          churchVillagesInput.value = count;
          updateChurchFeedback();
          syncNote.innerHTML =
            "✓ " + count + " " + escapeHtml(villagesHaveChurchLabel(count)) + ' (<a href="#" id="registry-link">' + escapeHtml(t("entry.registryLink")) + "</a>)";
        } else {
          syncNote.innerHTML =
            escapeHtml(t("entry.registryHint")) + ' <a href="#" id="registry-link">' + escapeHtml(t("entry.registryLink")) + "</a>.";
        }
        var link = document.getElementById("registry-link");
        if (link) {
          link.addEventListener("click", function (e) {
            e.preventDefault();
            setView("registry", meta.id);
          });
        }
      });
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
      el.textContent = "= " + fmtPct(pct) + " " + t("entry.feedback.percentOfPop");
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
      el.textContent = "= " + fmtPct((withChurch / villages) * 100, 0) + " " + t("entry.feedback.percentVillages");
      el.classList.toggle("warn", withChurch > villages);
    }

    provinceSelect.addEventListener("change", applyReferences);
    populationInput.addEventListener("input", updateAttendanceFeedback);
    attendanceInput.addEventListener("input", updateAttendanceFeedback);
    villagesInput.addEventListener("input", updateChurchFeedback);
    churchVillagesInput.addEventListener("input", updateChurchFeedback);

    if (preselect) applyReferences();

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
      alertEl.innerHTML = '<div class="alert error">' + escapeHtml(t("entry.error.selectProvince")) + "</div>";
      return;
    }

    var population = Number(document.getElementById("f-population").value);
    var totalVillages = Number(document.getElementById("f-villages").value);
    var villagesWithChurches = Number(document.getElementById("f-churches-villages").value);
    var sundayAttendance = Number(document.getElementById("f-attendance").value);

    if (villagesWithChurches > totalVillages) {
      alertEl.innerHTML = '<div class="alert error">' + escapeHtml(t("entry.error.villagesExceed")) + "</div>";
      return;
    }
    if (sundayAttendance > population) {
      alertEl.innerHTML = '<div class="alert error">' + escapeHtml(t("entry.error.attendanceExceed")) + "</div>";
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
    submitBtn.textContent = t("entry.submitting");

    try {
      var res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      var body = await res.json();
      if (!res.ok) throw new Error(body.error || "Something went wrong.");

      alertEl.innerHTML = '<div class="alert success">' + escapeHtml(t("entry.success")) + " " + escapeHtml(provinceName(meta)) + ". " + escapeHtml(t("entry.thankyou")) + "</div>";
      remember(REMEMBER_NAME_KEY, payload.enteredBy);
      remember(REMEMBER_PASSCODE_KEY, payload.passcode);
      await loadData();
      setTimeout(function () {
        setView("province", provinceId);
      }, 900);
    } catch (err) {
      alertEl.innerHTML = '<div class="alert error">' + escapeHtml(err.message) + "</div>";
      submitBtn.disabled = false;
      submitBtn.textContent = t("entry.submit");
    }
  }

  function emptyToNull(v) {
    return v === "" || v === null || v === undefined ? null : Number(v);
  }

  // ---------- Village Registry ----------

  async function renderRegistry(provinceId) {
    var meta = findProvinceMeta(provinceId);
    if (!meta) {
      setView("dashboard");
      return;
    }

    appEl.innerHTML =
      '<div class="back-link"><button class="link" id="back-to-province">&larr; ' + escapeHtml(provinceName(meta)) + '</button></div>' +
      '<div class="card"><div class="loading">' + escapeHtml(t("registry.loading")) + '</div></div>';
    document.getElementById("back-to-province").addEventListener("click", function () {
      setView("province", provinceId);
    });

    var hierarchy, status;
    try {
      var results = await Promise.all([loadVillageHierarchy(provinceId), loadVillageStatus(provinceId)]);
      hierarchy = results[0];
      status = results[1];
    } catch (e) {
      appEl.innerHTML += '<div class="alert error">' + escapeHtml(t("registry.saveError")) + "</div>";
      return;
    }

    if (state.view !== "registry" || state.selectedProvinceId !== provinceId) return; // navigated away while loading

    var rememberedPasscode = remembered(REMEMBER_PASSCODE_KEY);
    var lang = window.I18N.getLang();

    function districtHtml(d) {
      var communesHtml = d.communes
        .map(function (c) {
          var churchCount = c.villages.filter(function (v) {
            return status[v.code] && status[v.code].hasChurch;
          }).length;
          var villagesHtml = c.villages
            .map(function (v) {
              var st = status[v.code] || {};
              return (
                '<div class="village-row" data-code="' +
                v.code +
                '" data-search="' +
                escapeHtml((v.latin + " " + v.khmer + " " + c.latin + " " + c.khmer + " " + d.latin + " " + d.khmer).toLowerCase()) +
                '">' +
                '<label class="village-toggle ' + (st.hasChurch ? "checked" : "") + '"><input type="checkbox" class="v-check" ' +
                (st.hasChurch ? "checked" : "") +
                ">" + escapeHtml(t("registry.hasChurch")) + "</label>" +
                '<span class="v-name">' +
                escapeHtml(v.latin) +
                '<span class="khmer">' +
                escapeHtml(v.khmer) +
                "</span></span>" +
                '<input type="text" class="village-note v-note" placeholder="' +
                escapeHtml(t("registry.notePlaceholder")) +
                '" value="' +
                escapeHtml(st.note || "") +
                '">' +
                '<span class="village-save-state"></span>' +
                "</div>"
              );
            })
            .join("");
          return (
            '<details class="registry-commune"><summary>' +
            "<span>" + escapeHtml(lang === "km" ? c.khmer : c.latin) + '</span><span class="count">' +
            churchCount +
            " / " +
            c.villages.length +
            " " + escapeHtml(t("registry.villages")) + "</span></summary>" +
            villagesHtml +
            "</details>"
          );
        })
        .join("");
      var dChurchCount = d.communes.reduce(function (sum, c) {
        return sum + c.villages.filter(function (v) { return status[v.code] && status[v.code].hasChurch; }).length;
      }, 0);
      var dVillageCount = d.communes.reduce(function (sum, c) { return sum + c.villages.length; }, 0);
      return (
        '<details class="registry-district"><summary>' +
        '<span>' + escapeHtml(t("registry.district")) + ": " + escapeHtml(lang === "km" ? d.khmer : d.latin) + '</span><span class="count">' +
        dChurchCount +
        " / " +
        dVillageCount +
        " " + escapeHtml(t("registry.villages")) + "</span></summary>" +
        communesHtml +
        "</details>"
      );
    }

    var churchCount = registryChurchCount(provinceId) || 0;

    appEl.innerHTML =
      '<div class="back-link"><button class="link" id="back-to-province">&larr; ' + escapeHtml(provinceName(meta)) + '</button></div>' +
      '<div class="card">' +
      '<div class="section-title">' + escapeHtml(t("registry.title")) + " — " + escapeHtml(provinceName(meta)) + '</div>' +
      '<div class="section-sub">' + escapeHtml(t("registry.sub")) + '</div>' +
      '<div class="registry-summary-bar"><div><div class="registry-summary-figure" id="registry-summary-figure">' +
      churchCount +
      " " + escapeHtml(t("registry.of")) + " " + hierarchy.villageCount + " " + escapeHtml(villagesHaveChurchLabel(churchCount)) +
      '</div><div class="stat-foot">' + hierarchy.districtCount + ' ' + escapeHtml(t("registry.district")).toLowerCase() + 's · ' + hierarchy.communeCount + ' ' + escapeHtml(t("registry.commune")).toLowerCase() + 's</div></div></div>' +
      '<div class="registry-passcode-bar"><label for="registry-passcode">' + escapeHtml(t("registry.passcodeNeeded")) + '</label><input type="password" id="registry-passcode" value="' +
      escapeHtml(rememberedPasscode) +
      '"></div>' +
      '<input type="text" class="registry-search" id="registry-search" placeholder="' + escapeHtml(t("registry.search")) + '">' +
      '<div id="registry-tree">' +
      hierarchy.districts.map(districtHtml).join("") +
      "</div>" +
      '<p class="muted" style="margin-top:14px;font-size:0.78rem">' + escapeHtml(t("registry.dataSource")) + "</p>" +
      "</div>";

    document.getElementById("back-to-province").addEventListener("click", function () {
      setView("province", provinceId);
    });

    var treeEl = document.getElementById("registry-tree");
    var summaryFigureEl = document.getElementById("registry-summary-figure");
    var passcodeInput = document.getElementById("registry-passcode");

    function updateSummary() {
      var count = registryChurchCount(provinceId) || 0;
      summaryFigureEl.textContent = count + " " + t("registry.of") + " " + hierarchy.villageCount + " " + villagesHaveChurchLabel(count);
    }

    treeEl.addEventListener("change", function (e) {
      if (!e.target.classList.contains("v-check")) return;
      saveVillageRow(e.target);
    });
    treeEl.addEventListener(
      "blur",
      function (e) {
        if (!e.target.classList.contains("v-note")) return;
        saveVillageRow(e.target);
      },
      true
    );

    function saveVillageRow(originEl) {
      var row = originEl.closest(".village-row");
      var code = row.getAttribute("data-code");
      var checkbox = row.querySelector(".v-check");
      var noteInput = row.querySelector(".v-note");
      var saveState = row.querySelector(".village-save-state");
      var hasChurch = checkbox.checked;
      var note = noteInput.value.trim();
      var passcode = passcodeInput.value;

      row.querySelector(".village-toggle").classList.toggle("checked", hasChurch);
      saveState.textContent = "⏳";

      fetch("/api/villages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provinceId: provinceId,
          villageCode: code,
          hasChurch: hasChurch,
          note: note,
          passcode: passcode,
          updatedBy: remembered(REMEMBER_NAME_KEY),
        }),
      })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (b) { throw new Error(b.error || "Save failed"); });
          return res.json();
        })
        .then(function () {
          status[code] = { hasChurch: hasChurch, note: note };
          state.villageStatus[provinceId] = status;
          remember(REMEMBER_PASSCODE_KEY, passcode);
          saveState.textContent = "✓";
          setTimeout(function () {
            saveState.textContent = "";
          }, 1500);
          updateSummary();
        })
        .catch(function () {
          checkbox.checked = !hasChurch;
          row.querySelector(".village-toggle").classList.toggle("checked", !hasChurch);
          saveState.textContent = "!";
          saveState.title = t("registry.saveError");
        });
    }

    document.getElementById("registry-search").addEventListener("input", function () {
      var query = this.value.trim().toLowerCase();
      var rows = treeEl.querySelectorAll(".village-row");
      if (!query) {
        rows.forEach(function (r) {
          r.style.display = "";
        });
        treeEl.querySelectorAll("details").forEach(function (d) {
          d.open = false;
        });
        return;
      }
      var anyMatchByParent = {};
      rows.forEach(function (r) {
        var match = r.getAttribute("data-search").indexOf(query) !== -1;
        r.style.display = match ? "" : "none";
        if (match) {
          var commune = r.closest(".registry-commune");
          var district = r.closest(".registry-district");
          if (commune) commune.open = true;
          if (district) district.open = true;
        }
      });
    });
  }

  applyStaticTranslations();
  loadData();
})();
