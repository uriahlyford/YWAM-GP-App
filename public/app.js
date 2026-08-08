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
    registrySummary: null, // provinceId -> marked-village count (lightweight, all provinces)
    paceOpts: null, // user-adjusted projection assumptions, null = defaults
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
    document.getElementById("tab-pace").textContent = t("nav.pace");
    document.getElementById("tab-registry").textContent = t("nav.registry");
    document.getElementById("tab-entry").textContent = t("nav.entry");
    document.getElementById("footer-text").textContent = t("footer.text");
    document.title = t("app.title") + " — Cambodia Church Growth Tracker";
    var lang = window.I18N.getLang();
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang-opt]"), function (el) {
      el.classList.toggle("active", el.getAttribute("data-lang-opt") === lang);
    });
  }

  // Sub-views highlight the top-level tab they belong to.
  var TAB_FOR_VIEW = {
    dashboard: "dashboard",
    province: "dashboard",
    pace: "pace",
    "registry-picker": "registry-picker",
    registry: "registry-picker",
    entry: "entry",
  };

  function setView(view, provinceId, from) {
    state.view = view;
    state.selectedProvinceId = provinceId || null;
    if (from) state.registryFrom = from;
    var activeTab = TAB_FOR_VIEW[view] || "dashboard";
    Array.prototype.forEach.call(tabsEl.querySelectorAll(".tab"), function (t) {
      t.classList.toggle("active", t.getAttribute("data-view") === activeTab);
    });
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function registryBackLabel(meta) {
    return state.registryFrom === "picker" ? t("registry.backToPicker") : provinceName(meta);
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

  function estimateFor(provinceId) {
    var seeds = window.SEED_ESTIMATES;
    if (!seeds || !seeds[provinceId]) return null;
    var meta = findProvinceMeta(provinceId);
    var seed = seeds[provinceId];
    var population = meta.referencePopulation;
    return {
      percentChristian: seed.percentChristian,
      estimatedAttendance: Math.round((population * seed.percentChristian) / 100),
      confidence: seed.confidence,
      note: seed.note,
      source: seed.source,
    };
  }

  function getProvinceRecord(id) {
    return state.provinces.find(function (p) {
      return p.id === id;
    });
  }

  // Optional: per-province church counts imported from the cambodiachurches.org directory
  // via scripts/import-churches.mjs. Absent until someone runs that importer from an
  // unblocked network, so everything here degrades to a clean no-op.
  function loadChurchCounts() {
    return new Promise(function (resolve) {
      if (window.CHURCH_COUNTS) return resolve();
      var s = document.createElement("script");
      s.src = "/data/church-counts.js";
      s.onload = resolve;
      s.onerror = resolve; // not imported yet — expected
      document.head.appendChild(s);
    });
  }

  function churchCountFor(provinceId) {
    var c = window.CHURCH_COUNTS;
    return c && c[provinceId] && typeof c[provinceId].total === "number" ? c[provinceId].total : null;
  }

  // Small inline hint on a commune: "directory lists N here". Helps a pastor see where
  // churches are already known to exist before they start ticking villages.
  function directoryHint(provinceId, communeCode) {
    var n = communeChurchCount(provinceId, communeCode);
    if (n === null || n <= 0) return "";
    return ' <span class="directory-hint" title="' + escapeHtml(t("registry.directoryTitle")) + '">' + n + " 📖</span>";
  }

  function communeChurchCount(provinceId, communeCode) {
    var c = window.CHURCH_COUNTS;
    if (!c || !c[provinceId] || !c[provinceId].communes) return null;
    var n = c[provinceId].communes[communeCode];
    return typeof n === "number" ? n : null;
  }

  /**
   * A Google Maps search link for one commune.
   *
   * This is the one use of Google Maps the licence clearly allows: sending a person to Google
   * Maps to look something up. Bulk-importing Places results into this app would not be — their
   * terms forbid storing place names and addresses — which is why the automated import uses
   * OpenStreetMap instead.
   */
  function mapsSearchUrl(provinceMeta, districtLatin, communeLatin) {
    var q = ["church", communeLatin, districtLatin, provinceMeta.name, "Cambodia"]
      .filter(Boolean)
      .join(" ");
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }

  /** Village-level directory entry, if the deep import placed a church here. */
  function directoryVillage(provinceId, villageCode) {
    var c = window.CHURCH_COUNTS;
    if (!c || !c[provinceId] || !c[provinceId].villages) return null;
    return c[provinceId].villages[villageCode] || null;
  }

  /**
   * What a village row should show, merging two sources.
   *
   * A pastor's own entry always wins — including a deliberate "no church here", which must
   * not be silently overwritten by directory data. Otherwise the directory pre-fills the row
   * so nobody re-enters what is already publicly known, marked as unconfirmed until a pastor
   * touches it.
   */
  function villageState(provinceId, villageCode, status) {
    var own = status[villageCode];
    if (own) {
      return { hasChurch: !!own.hasChurch, note: own.note || "", source: "pastor" };
    }
    var dir = directoryVillage(provinceId, villageCode);
    if (dir) {
      return { hasChurch: true, note: dir.church || "", source: "directory" };
    }
    return { hasChurch: false, note: "", source: null };
  }

  async function loadData() {
    state.loading = true;
    state.loadError = null;
    render();
    await Promise.all([loadChurchCounts(), loadRegistrySummary()]);
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

  /** Villages marked as having a church, across every province whose status we've loaded. */
  function nationalRegistryTotals() {
    var marked = 0;
    var total = 0;
    window.PROVINCES.forEach(function (meta) {
      total += meta.referenceVillages;
      var n = registryChurchCount(meta.id);
      if (n !== null) marked += n;
    });
    return { marked: marked, total: total };
  }

  /** Villages the directory places a church in, that no pastor has ruled on yet. */
  function directoryPendingCount(provinceId, status) {
    var c = window.CHURCH_COUNTS;
    if (!c || !c[provinceId] || !c[provinceId].villages) return 0;
    var own = status || state.villageStatus[provinceId] || {};
    return Object.keys(c[provinceId].villages).filter(function (code) {
      return !own[code];
    }).length;
  }

  function registryChurchCount(provinceId) {
    // Prefer the fully-loaded status map (freshest — reflects unsaved-then-saved ticks),
    // and fall back to the lightweight national summary. Directory-sourced villages count
    // too: they are shown as marked in the registry, so the totals must agree.
    var status = state.villageStatus[provinceId];
    if (status) {
      var n = 0;
      Object.keys(status).forEach(function (code) {
        if (status[code] && status[code].hasChurch) n++;
      });
      return n + directoryPendingCount(provinceId, status);
    }
    if (state.registrySummary) {
      // A province with no saved entries still has directory pre-fills to count, so don't
      // bail out just because the summary has no row for it.
      var saved = typeof state.registrySummary[provinceId] === "number" ? state.registrySummary[provinceId] : 0;
      return saved + directoryPendingCount(provinceId, {});
    }
    return null;
  }

  async function loadRegistrySummary() {
    try {
      var res = await fetch("/api/villages?summary=1");
      if (!res.ok) return;
      var data = await res.json();
      state.registrySummary = data.counts || {};
    } catch (e) {
      state.registrySummary = {};
    }
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
    } else if (state.view === "pace") {
      renderPace();
    } else if (state.view === "registry-picker") {
      renderRegistryPicker();
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

  /**
   * The best current picture of the whole country.
   *
   * Provinces a pastor has confirmed use their real reported numbers; the rest fall back
   * to the research estimate. Both are expressed against Cambodia's full population, so
   * `confirmedPercent` and `blendedPercent` sit on the same scale and the progress meter
   * can show confirmed progress growing inside the estimated total.
   */
  function computeNationalPicture() {
    var nationalPop = 0,
      confirmedChristians = 0,
      estimatedChristians = 0,
      confirmedProvinces = 0;

    window.PROVINCES.forEach(function (meta) {
      var rec = getProvinceRecord(meta.id);
      var latest = rec ? latestOf(rec) : null;
      if (latest) {
        confirmedProvinces++;
        nationalPop += latest.population || meta.referencePopulation;
        confirmedChristians += latest.sundayAttendance || 0;
      } else {
        var est = estimateFor(meta.id);
        nationalPop += meta.referencePopulation;
        estimatedChristians += est ? est.estimatedAttendance : 0;
      }
    });

    var totalChristians = confirmedChristians + estimatedChristians;
    return {
      nationalPop: nationalPop,
      confirmedChristians: confirmedChristians,
      estimatedChristians: estimatedChristians,
      totalChristians: totalChristians,
      confirmedProvinces: confirmedProvinces,
      blendedPercent: nationalPop ? (totalChristians / nationalPop) * 100 : null,
      confirmedPercent: nationalPop ? (confirmedChristians / nationalPop) * 100 : null,
    };
  }

  // ---------- Pace to 2033 ----------

  function currentYear() {
    return new Date().getFullYear();
  }

  function projectedPopulation(year, growth) {
    var P = window.PROJECTION;
    return P.populationBase * Math.pow(1 + growth, year - P.populationBaseYear);
  }

  /**
   * The whole plan in one object: what reaching 10% by 2033 actually requires each year,
   * versus where the current growth rate lands.
   *
   * Required growth is modelled as a constant compound rate rather than a straight line,
   * because movements compound — and because the monthly version of a compound rate is the
   * number a local leader can actually act on.
   */
  function computePace(opts) {
    var P = window.PROJECTION;
    var popGrowth = opts && opts.popGrowth !== undefined ? opts.popGrowth : P.populationGrowth;
    var believerGrowth = opts && opts.believerGrowth !== undefined ? opts.believerGrowth : P.believerGrowth;

    var picture = computeNationalPicture();
    var startYear = currentYear();
    var years = Math.max(1, P.goalYear - startYear);

    // The percentage is what we actually estimated; the believer count follows from it.
    // Deriving today's count from that percentage against today's projected population (rather
    // than reusing the count computed against the 2024 census base) keeps the headline figure
    // and the first row of the year-by-year table agreeing with each other.
    var currentPercent = picture.blendedPercent || 0;
    var startPop = projectedPopulation(startYear, popGrowth);
    var current = (currentPercent / 100) * startPop;

    var goalPop = projectedPopulation(P.goalYear, popGrowth);
    var target = (goalPop * P.goalPercent) / 100;
    var gap = target - current;

    var requiredCagr = Math.pow(target / current, 1 / years) - 1;
    var requiredMonthly = Math.pow(1 + requiredCagr, 1 / 12) - 1;

    var rows = [];
    var prevRequired = current;
    for (var y = startYear; y <= P.goalYear; y++) {
      var n = y - startYear;
      var pop = projectedPopulation(y, popGrowth);
      var required = current * Math.pow(1 + requiredCagr, n);
      var trajectory = current * Math.pow(1 + believerGrowth, n);
      rows.push({
        year: y,
        population: pop,
        required: required,
        requiredPercent: (required / pop) * 100,
        newThisYear: n === 0 ? 0 : required - prevRequired,
        trajectory: trajectory,
        trajectoryPercent: (trajectory / pop) * 100,
      });
      prevRequired = required;
    }

    var endTrajectory = current * Math.pow(1 + believerGrowth, years);
    var perYear = gap / years;

    // If every church that already exists doubled its attendance, how much of the gap closes?
    var avgChurchSize = P.knownChurches ? current / P.knownChurches : 0;
    var doublingCovers = gap > 0 ? (current / gap) * 100 : 0;
    // Remaining gap has to come from churches that don't exist yet.
    var newChurchesNeeded = avgChurchSize > 0 ? Math.max(0, gap - current) / avgChurchSize : 0;

    return {
      startYear: startYear,
      years: years,
      current: current,
      currentPercent: picture.blendedPercent,
      goalPop: goalPop,
      target: target,
      gap: gap,
      perYear: perYear,
      perMonth: perYear / 12,
      perWeek: perYear / 52,
      perDay: perYear / 365,
      requiredCagr: requiredCagr,
      requiredMonthly: requiredMonthly,
      believerGrowth: believerGrowth,
      popGrowth: popGrowth,
      endTrajectory: endTrajectory,
      endTrajectoryPercent: (endTrajectory / goalPop) * 100,
      shortfall: target - endTrajectory,
      perVillageAtGoal: target / P.totalVillages,
      avgChurchSize: avgChurchSize,
      doublingCovers: doublingCovers,
      newChurchesNeeded: newChurchesNeeded,
      newChurchesPerYear: newChurchesNeeded / years,
      rows: rows,
    };
  }

  /** A single province's share of the national goal, on the same model. */
  function provincePace(provinceId, popGrowth) {
    var P = window.PROJECTION;
    var meta = findProvinceMeta(provinceId);
    if (!meta) return null;
    var growth = popGrowth === undefined ? P.populationGrowth : popGrowth;

    var rec = getProvinceRecord(provinceId);
    var latest = rec ? latestOf(rec) : null;
    var est = estimateFor(provinceId);
    var current = latest ? latest.sundayAttendance : est ? est.estimatedAttendance : 0;
    var basePop = latest && latest.population ? latest.population : meta.referencePopulation;

    var years = Math.max(1, P.goalYear - currentYear());
    var pop2033 = basePop * Math.pow(1 + growth, P.goalYear - P.populationBaseYear);
    var target = (pop2033 * P.goalPercent) / 100;
    var gap = Math.max(0, target - current);

    return {
      current: current,
      confirmed: !!latest,
      target: target,
      gap: gap,
      perYear: gap / years,
      perWeek: gap / years / 52,
      villages: meta.referenceVillages,
      perVillageAtGoal: target / meta.referenceVillages,
      years: years,
    };
  }

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
        var est = estimateFor(r.meta.id);
        var confirmed = !!latest;
        var effPop = confirmed ? latest.population : r.meta.referencePopulation;
        var effAttendance = confirmed ? latest.sundayAttendance : est ? est.estimatedAttendance : null;
        var effPct = confirmed
          ? latest.population ? (latest.sundayAttendance / latest.population) * 100 : null
          : est ? est.percentChristian : null;
        var churchPct = confirmed && latest.totalVillages ? (latest.villagesWithChurches / latest.totalVillages) * 100 : null;
        var numClass = confirmed ? ' class="numeric"' : ' class="numeric est-value"';
        return (
          '<tr data-province="' +
          r.meta.id +
          '">' +
          "<td>" +
          escapeHtml(provinceName(r.meta)) +
          "</td>" +
          "<td" + numClass + ">" +
          fmtNum(effPop) +
          "</td>" +
          "<td" + numClass + ">" +
          (effAttendance !== null ? fmtNum(effAttendance) : "—") +
          "</td>" +
          "<td" + numClass + ">" +
          fmtPct(effPct) +
          "</td>" +
          '<td class="numeric">' +
          (confirmed ? latest.villagesWithChurches + " / " + latest.totalVillages + " (" + fmtPct(churchPct, 0) + ")" : "—") +
          "</td>" +
          "<td>" +
          (latest ? fmtDate(latest.date) : "—") +
          "</td>" +
          "<td>" +
          (confirmed
            ? '<span class="badge reporting">' + escapeHtml(t("badge.reporting")) + "</span>"
            : est
            ? '<span class="badge estimated" title="' + escapeHtml(est.note || "") + '">' + escapeHtml(t("badge.estimated")) + "</span>"
            : '<span class="badge none">' + escapeHtml(t("badge.noData")) + "</span>") +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    var picture = computeNationalPicture();
    var goalPercent = window.GOAL.targetPercent;
    var estWidth = picture.blendedPercent !== null ? Math.min(100, (picture.blendedPercent / goalPercent) * 100) : 0;
    var confWidth = picture.confirmedPercent !== null ? Math.min(100, (picture.confirmedPercent / goalPercent) * 100) : 0;
    var registryTotals = nationalRegistryTotals();

    appEl.innerHTML =
      '<div class="hero">' +
      '<div class="hero-eyebrow">' + escapeHtml(t("hero.eyebrow")) + "</div>" +
      '<h1 class="hero-title">' + escapeHtml(t("hero.title")) + "</h1>" +
      '<p class="hero-sub">' + escapeHtml(t("hero.sub")) + "</p>" +
      '<div class="hero-figures">' +
      '<div class="hero-figure-item">' +
      '<span class="hero-figure-value">' + fmtPct(picture.blendedPercent) + "</span>" +
      '<span class="hero-figure-label">' + escapeHtml(t("hero.figures.following")) + "</span>" +
      "</div>" +
      '<div class="hero-figure-item">' +
      '<span class="hero-figure-value neutral">' + fmtNum(picture.totalChristians) + "</span>" +
      '<span class="hero-figure-label">' + escapeHtml(t("hero.figures.people")) + "</span>" +
      "</div>" +
      '<div class="hero-figure-item">' +
      '<span class="hero-figure-value neutral">' + fmtNum(picture.nationalPop) + "</span>" +
      '<span class="hero-figure-label">' + escapeHtml(t("hero.figures.population")) + "</span>" +
      "</div>" +
      '<div class="hero-figure-item">' +
      '<span class="hero-figure-value neutral">' + yearsLeft + "</span>" +
      '<span class="hero-figure-label">' + escapeHtml(t("hero.figures.yearsLeft")) + "</span>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="card goal-card">' +
      '<div class="goal-row"><div><h3>' + escapeHtml(t("goal.title")) + "</h3>" +
      '<div class="goal-sub">' + escapeHtml(t("goal.labelTarget")) + "</div></div>" +
      '<span class="goal-pct">' + fmtPct(picture.blendedPercent) + "</span></div>" +
      '<div class="progress-track">' +
      '<div class="progress-estimated" style="width:' + estWidth + '%"></div>' +
      '<div class="progress-confirmed" style="width:' + confWidth + '%"></div>' +
      '<div class="progress-ticks">' +
      [20, 40, 60, 80].map(function (p) { return '<span style="left:' + p + '%"></span>'; }).join("") +
      "</div>" +
      "</div>" +
      '<div class="progress-labels">' +
      [0, 2, 4, 6, 8, 10].map(function (p) { return "<span>" + p + "%</span>"; }).join("") +
      "</div>" +
      '<div class="progress-legend">' +
      '<span class="legend-item"><span class="legend-swatch confirmed"></span>' +
      escapeHtml(t("goal.legend.confirmed")) + ' <span class="legend-value">' + fmtPct(picture.confirmedPercent) + " · " + fmtNum(picture.confirmedChristians) + "</span></span>" +
      '<span class="legend-item"><span class="legend-swatch estimated"></span>' +
      escapeHtml(t("goal.legend.estimated")) + ' <span class="legend-value">' + fmtPct(picture.blendedPercent) + " · " + fmtNum(picture.totalChristians) + "</span></span>" +
      "</div>" +
      (window.NATIONAL_ESTIMATE
        ? '<div class="research-estimate-note">' +
          escapeHtml(t("goal.methodNote")) + " " +
          "<strong>" + fmtPct(window.NATIONAL_ESTIMATE.percentChristian) + "</strong> " +
          escapeHtml(t("goal.researchEstimate")) + " " +
          escapeHtml(window.NATIONAL_ESTIMATE.source) + " (" + window.NATIONAL_ESTIMATE.asOfYear + "). " +
          escapeHtml(t("goal.governmentFigure")) + " " + fmtPct(window.NATIONAL_ESTIMATE.governmentPercent) + "." +
          "</div>"
        : "") +
      '<button class="link" id="see-pace" style="margin-top:16px">' + escapeHtml(t("goal.seePace")) + " &rarr;</button>" +
      "</div>" +
      '<div class="registry-promo">' +
      '<div class="registry-promo-body">' +
      "<h3>🗺️ " + escapeHtml(t("registry.promo.title")) + "</h3>" +
      "<p>" + escapeHtml(t("registry.promo.body")) + "</p>" +
      '<div class="registry-promo-stat">' +
      fmtNum(registryTotals.marked) + " " + escapeHtml(t("registry.of")) + " " + fmtNum(registryTotals.total) + " " + escapeHtml(t("registry.promo.marked")) +
      "</div>" +
      "</div>" +
      '<button class="pill-link" id="promo-registry">' + escapeHtml(t("registry.promo.cta")) + " &rarr;</button>" +
      "</div>" +
      '<div class="grid stats" style="margin-top:16px">' +
      statCard("⛪", t("stat.reportingProvinces"), picture.confirmedProvinces + " / " + window.PROVINCES.length, t("stat.reportingProvinces.foot")) +
      statCard("👥", t("stat.totalPopulation"), fmtNum(totals.totalPop), t("stat.totalPopulation.foot")) +
      statCard("🙏", t("stat.attendance"), fmtNum(totals.totalChristians), t("stat.attendance.foot")) +
      statCard("🏘️", t("stat.villagesWithChurch"), (totals.totalVillages ? totals.totalVillagesWithChurches + " / " + totals.totalVillages : "—"), fmtPct(totals.percentVillagesWithChurches, 1) + " " + t("stat.villagesWithChurch.foot")) +
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
      '<p class="muted" style="margin-top:12px;font-size:0.78rem">' + escapeHtml(t("table.legend.estimated")) + "</p>" +
      "</div>";

    Array.prototype.forEach.call(appEl.querySelectorAll("tr[data-province]"), function (tr) {
      tr.addEventListener("click", function () {
        setView("province", tr.getAttribute("data-province"));
      });
    });

    document.getElementById("promo-registry").addEventListener("click", function () {
      setView("registry-picker");
    });
    document.getElementById("see-pace").addEventListener("click", function () {
      setView("pace");
    });

    renderNationalChart();
  }

  // ---------- Pace to 2033 view ----------

  function renderPace() {
    var pace = computePace(state.paceOpts);
    var P = window.PROJECTION;

    var rowsHtml = pace.rows
      .map(function (r, i) {
        var behind = r.trajectory < r.required;
        return (
          "<tr>" +
          "<td><strong>" + r.year + "</strong>" + (i === 0 ? ' <span class="muted">(' + escapeHtml(t("pace.today")) + ")</span>" : "") + "</td>" +
          '<td class="numeric">' + fmtNum(r.population) + "</td>" +
          '<td class="numeric"><strong>' + fmtNum(r.required) + "</strong></td>" +
          '<td class="numeric">' + fmtPct(r.requiredPercent) + "</td>" +
          '<td class="numeric">' + (i === 0 ? "—" : "+" + fmtNum(r.newThisYear)) + "</td>" +
          '<td class="numeric ' + (behind ? "est-value" : "") + '">' + fmtNum(r.trajectory) + " <span class=\"muted\">(" + fmtPct(r.trajectoryPercent) + ")</span></td>" +
          "</tr>"
        );
      })
      .join("");

    appEl.innerHTML =
      '<div class="card">' +
      '<div class="section-title">' + escapeHtml(t("pace.title")) + "</div>" +
      '<div class="section-sub">' + escapeHtml(t("pace.sub")) + "</div>" +

      // headline contrast
      '<div class="pace-headline">' +
      '<div class="pace-headline-item">' +
      '<div class="pace-headline-value">' + fmtPct(pace.currentPercent) + "</div>" +
      '<div class="pace-headline-label">' + escapeHtml(t("pace.headline.today")) + "</div>" +
      "</div>" +
      '<div class="pace-arrow">&rarr;</div>' +
      '<div class="pace-headline-item">' +
      '<div class="pace-headline-value accent">' + fmtPct(P.goalPercent, 0) + "</div>" +
      '<div class="pace-headline-label">' + escapeHtml(t("pace.headline.goal")) + "</div>" +
      "</div>" +
      '<div class="pace-headline-item wide">' +
      '<div class="pace-headline-value">' + fmtPct(pace.endTrajectoryPercent) + "</div>" +
      '<div class="pace-headline-label">' + escapeHtml(t("pace.headline.trajectory")) + "</div>" +
      "</div>" +
      "</div>" +

      '<div class="pace-verdict">' + escapeHtml(t("pace.verdict.lead")) + " <strong>" +
      fmtNum(pace.shortfall) + " " + escapeHtml(t("pace.verdict.short")) + "</strong> " +
      escapeHtml(t("pace.verdict.tail")) + "</div>" +

      '<div class="chart-wrap" style="margin-top:22px"><canvas id="pace-chart"></canvas></div>' +

      // assumptions
      '<div class="assumptions">' +
      '<div class="assumptions-title">' + escapeHtml(t("pace.assumptions.title")) + "</div>" +
      '<div class="assumptions-row">' +
      '<label class="assumption"><span>' + escapeHtml(t("pace.assumptions.popGrowth")) + "</span>" +
      '<input type="number" id="a-pop" step="0.1" min="0" max="5" value="' + (pace.popGrowth * 100).toFixed(1) + '"><span class="unit">%/yr</span></label>' +
      '<label class="assumption"><span>' + escapeHtml(t("pace.assumptions.believerGrowth")) + "</span>" +
      '<input type="number" id="a-bel" step="0.1" min="0" max="60" value="' + (pace.believerGrowth * 100).toFixed(1) + '"><span class="unit">%/yr</span></label>' +
      '<button class="link" id="a-reset">' + escapeHtml(t("pace.assumptions.reset")) + "</button>" +
      "</div>" +
      '<p class="assumptions-note">' + escapeHtml(t("pace.assumptions.note")) + "</p>" +
      "</div>" +
      "</div>" +

      // what it means
      '<div class="card" style="margin-top:18px">' +
      '<div class="section-title">' + escapeHtml(t("pace.means.title")) + "</div>" +
      '<div class="section-sub">' + escapeHtml(t("pace.means.sub")) + "</div>" +
      '<div class="grid stats">' +
      statCard("📅", t("pace.means.perYear"), fmtNum(pace.perYear), t("pace.means.perYear.foot")) +
      statCard("🗓️", t("pace.means.perWeek"), fmtNum(pace.perWeek), t("pace.means.perWeek.foot")) +
      statCard("📈", t("pace.means.monthly"), fmtPct(pace.requiredMonthly * 100, 2), t("pace.means.monthly.foot")) +
      statCard("🏘️", t("pace.means.perVillage"), fmtNum(pace.perVillageAtGoal), t("pace.means.perVillage.foot")) +
      "</div>" +
      '<div class="insight">' +
      "<h4>" + escapeHtml(t("pace.insight.multiply.title")) + "</h4>" +
      "<p>" + escapeHtml(t("pace.insight.multiply.body.a")) + " <strong>" + fmtPct(pace.doublingCovers, 0) + "</strong> " +
      escapeHtml(t("pace.insight.multiply.body.b")) + " <strong>" + fmtNum(pace.newChurchesPerYear) + "</strong> " +
      escapeHtml(t("pace.insight.multiply.body.c")) + "</p>" +
      "</div>" +
      '<div class="insight">' +
      "<h4>" + escapeHtml(t("pace.insight.monthly.title")) + "</h4>" +
      "<p>" + escapeHtml(t("pace.insight.monthly.body")) + "</p>" +
      "</div>" +
      '<div class="insight">' +
      "<h4>" + escapeHtml(t("pace.insight.leading.title")) + "</h4>" +
      "<p>" + escapeHtml(t("pace.insight.leading.body")) + "</p>" +
      "</div>" +
      "</div>" +

      // year by year
      '<div class="card" style="margin-top:18px">' +
      '<div class="section-title">' + escapeHtml(t("pace.table.title")) + "</div>" +
      '<div class="section-sub">' + escapeHtml(t("pace.table.sub")) + "</div>" +
      '<div class="table-wrap"><table class="provinces"><thead><tr>' +
      "<th>" + escapeHtml(t("pace.table.year")) + "</th>" +
      "<th>" + escapeHtml(t("pace.table.population")) + "</th>" +
      "<th>" + escapeHtml(t("pace.table.needed")) + "</th>" +
      "<th>" + escapeHtml(t("pace.table.percent")) + "</th>" +
      "<th>" + escapeHtml(t("pace.table.newThisYear")) + "</th>" +
      "<th>" + escapeHtml(t("pace.table.trajectory")) + "</th>" +
      "</tr></thead><tbody>" + rowsHtml + "</tbody></table></div>" +
      "</div>" +

      // per-province allocation
      '<div class="card" style="margin-top:18px">' +
      '<div class="section-title">' + escapeHtml(t("pace.province.title")) + "</div>" +
      '<div class="section-sub">' + escapeHtml(t("pace.province.sub")) + "</div>" +
      '<div class="table-wrap"><table class="provinces"><thead><tr>' +
      "<th>" + escapeHtml(t("table.province")) + "</th>" +
      "<th>" + escapeHtml(t("pace.province.now")) + "</th>" +
      "<th>" + escapeHtml(t("pace.province.target")) + "</th>" +
      "<th>" + escapeHtml(t("pace.province.perYear")) + "</th>" +
      "<th>" + escapeHtml(t("pace.province.perWeek")) + "</th>" +
      "</tr></thead><tbody>" +
      window.PROVINCES.slice()
        .map(function (m) { return { meta: m, pace: provincePace(m.id, pace.popGrowth) }; })
        .sort(function (a, b) { return b.pace.perYear - a.pace.perYear; })
        .map(function (r) {
          return (
            '<tr data-province="' + r.meta.id + '">' +
            "<td>" + escapeHtml(provinceName(r.meta)) + "</td>" +
            '<td class="numeric' + (r.pace.confirmed ? "" : " est-value") + '">' + fmtNum(r.pace.current) + "</td>" +
            '<td class="numeric">' + fmtNum(r.pace.target) + "</td>" +
            '<td class="numeric"><strong>+' + fmtNum(r.pace.perYear) + "</strong></td>" +
            '<td class="numeric">+' + fmtNum(r.pace.perWeek) + "</td>" +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table></div>" +
      "</div>";

    Array.prototype.forEach.call(appEl.querySelectorAll("tr[data-province]"), function (tr) {
      tr.addEventListener("click", function () { setView("province", tr.getAttribute("data-province")); });
    });

    function readAssumptions() {
      var pop = Number(document.getElementById("a-pop").value);
      var bel = Number(document.getElementById("a-bel").value);
      state.paceOpts = {
        popGrowth: isFinite(pop) && pop >= 0 ? pop / 100 : P.populationGrowth,
        believerGrowth: isFinite(bel) && bel >= 0 ? bel / 100 : P.believerGrowth,
      };
      render();
    }
    document.getElementById("a-pop").addEventListener("change", readAssumptions);
    document.getElementById("a-bel").addEventListener("change", readAssumptions);
    document.getElementById("a-reset").addEventListener("click", function () {
      state.paceOpts = null;
      render();
    });

    renderPaceChart(pace);
  }

  function renderPaceChart(pace) {
    var canvas = document.getElementById("pace-chart");
    if (!canvas) return;
    if (!window.Chart) { showChartFallback(canvas); return; }
    if (charts.pace) charts.pace.destroy();

    charts.pace = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: pace.rows.map(function (r) { return String(r.year); }),
        datasets: [
          {
            label: t("pace.chart.required"),
            data: pace.rows.map(function (r) { return r.requiredPercent; }),
            borderColor: CHART_THEME.accent,
            backgroundColor: CHART_THEME.accentFill,
            borderWidth: 2.5,
            fill: true,
            tension: 0.25,
            pointRadius: 3,
            pointBackgroundColor: CHART_THEME.accent,
          },
          {
            label: t("pace.chart.trajectory"),
            data: pace.rows.map(function (r) { return r.trajectoryPercent; }),
            borderColor: CHART_THEME.muted,
            borderWidth: 2,
            borderDash: [6, 5],
            fill: false,
            tension: 0.25,
            pointRadius: 2,
          },
        ],
      },
      options: Object.assign(baseChartOptions(), {
        interaction: { mode: "index", intersect: false },
        scales: {
          x: CHART_THEME.axis,
          y: Object.assign({ beginAtZero: true, suggestedMax: 11 }, CHART_THEME.axis, {
            ticks: Object.assign({}, CHART_THEME.axis.ticks, {
              callback: function (v) { return v + "%"; },
            }),
          }),
        },
      }),
    });
  }

  // ---------- Village Registry: province picker ----------

  function renderRegistryPicker() {
    var cards = window.PROVINCES.slice()
      .sort(function (a, b) { return provinceName(a).localeCompare(provinceName(b)); })
      .map(function (meta) {
        var marked = registryChurchCount(meta.id);
        var total = meta.referenceVillages;
        var pct = marked !== null && total ? (marked / total) * 100 : 0;
        return (
          '<button class="picker-card" data-province="' + meta.id + '">' +
          '<span class="picker-name">' + escapeHtml(provinceName(meta)) + "</span>" +
          '<span class="picker-bar"><span style="width:' + Math.min(100, pct) + '%"></span></span>' +
          '<span class="picker-meta">' +
          (marked !== null ? fmtNum(marked) : "0") + " " + escapeHtml(t("registry.of")) + " " + fmtNum(total) + " " + escapeHtml(t("registry.villages")) +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    var totals = nationalRegistryTotals();

    appEl.innerHTML =
      '<div class="card">' +
      '<div class="section-title">🗺️ ' + escapeHtml(t("registry.title")) + "</div>" +
      '<div class="section-sub">' + escapeHtml(t("registry.picker.sub")) + "</div>" +
      '<div class="registry-summary-bar">' +
      "<div>" +
      '<div class="registry-summary-figure">' +
      fmtNum(totals.marked) + " " + escapeHtml(t("registry.of")) + " " + fmtNum(totals.total) + " " + escapeHtml(t("registry.summary")) +
      "</div>" +
      '<div class="stat-foot">' + escapeHtml(t("registry.picker.nationwide")) + "</div>" +
      "</div>" +
      "</div>" +
      '<div class="picker-grid">' + cards + "</div>" +
      '<p class="muted" style="margin-top:16px;font-size:0.78rem">' + escapeHtml(t("registry.dataSource")) + "</p>" +
      "</div>";

    Array.prototype.forEach.call(appEl.querySelectorAll(".picker-card"), function (btn) {
      btn.addEventListener("click", function () {
        setView("registry", btn.getAttribute("data-province"), "picker");
      });
    });
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

  // Chart styling for the dark theme. Chart.js defaults assume a light background,
  // so axes/grid/legend all need explicit colors or they render nearly invisible.
  var CHART_THEME = {
    accent: "#A9502F",
    accentFill: "rgba(169, 80, 47, 0.10)",
    muted: "#9AA1AC",
    amber: "#8A6D3B",
    bg: "#FFFFFF",
    ink: "#4E5661",
    axis: {
      grid: { color: "rgba(22,24,28,0.07)", drawBorder: false },
      border: { display: false },
      ticks: { color: "#7A828E", font: { size: 11, family: "Plus Jakarta Sans, sans-serif" } },
    },
  };

  function baseChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: CHART_THEME.ink,
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8,
            font: { size: 12, family: "Space Grotesk, sans-serif" },
          },
        },
        tooltip: {
          backgroundColor: "#0E1421",
          borderColor: "rgba(255,255,255,0.14)",
          borderWidth: 1,
          titleColor: "#F2F6FC",
          bodyColor: "#97A6BF",
          padding: 11,
          cornerRadius: 8,
          titleFont: { family: "Space Grotesk, sans-serif" },
          bodyFont: { family: "JetBrains Mono, monospace", size: 11 },
        },
      },
    };
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
            borderColor: CHART_THEME.accent,
            backgroundColor: CHART_THEME.accentFill,
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            spanGaps: true,
            pointRadius: 3,
            pointBackgroundColor: CHART_THEME.accent,
            pointBorderColor: CHART_THEME.bg,
            pointBorderWidth: 2,
          },
          {
            label: t("chart.goal"),
            data: goalLine,
            borderColor: CHART_THEME.amber,
            borderWidth: 2,
            borderDash: [6, 5],
            spanGaps: true,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: Object.assign(baseChartOptions(), {
        interaction: { mode: "index", intersect: false },
        scales: {
          x: CHART_THEME.axis,
          y: Object.assign({ beginAtZero: true, suggestedMax: 11 }, CHART_THEME.axis, {
            ticks: Object.assign({}, CHART_THEME.axis.ticks, {
              callback: function (v) { return v + "%"; },
            }),
          }),
        },
      }),
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
      (churchCountFor(id) !== null
        ? statCard("📖", t("detail.directoryChurches"), fmtNum(churchCountFor(id)), t("detail.directorySource"))
        : "") +
      "</div>" +
      (function () {
        var pp = provincePace(id);
        if (!pp) return "";
        return (
          '<div class="pace-strip">' +
          '<div class="pace-strip-title">' + escapeHtml(t("detail.pace.title")) + "</div>" +
          '<div class="pace-strip-items">' +
          '<div><span class="pace-strip-value">' + fmtNum(pp.target) + '</span><span class="pace-strip-label">' + escapeHtml(t("detail.pace.target")) + "</span></div>" +
          '<div><span class="pace-strip-value accent">+' + fmtNum(pp.perYear) + '</span><span class="pace-strip-label">' + escapeHtml(t("detail.pace.perYear")) + "</span></div>" +
          '<div><span class="pace-strip-value">' + fmtNum(pp.perVillageAtGoal) + '</span><span class="pace-strip-label">' + escapeHtml(t("detail.pace.perVillage")) + "</span></div>" +
          "</div></div>"
        );
      })() +
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
      setView("registry", id, "province");
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
            borderColor: CHART_THEME.accent,
            backgroundColor: CHART_THEME.accentFill,
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: CHART_THEME.accent,
            pointBorderColor: CHART_THEME.bg,
            pointBorderWidth: 2,
            spanGaps: true,
          },
        ],
      },
      options: Object.assign(baseChartOptions(), {
        scales: {
          x: CHART_THEME.axis,
          y: Object.assign({ beginAtZero: true }, CHART_THEME.axis, {
            ticks: Object.assign({}, CHART_THEME.axis.ticks, {
              callback: function (v) { return v + "%"; },
            }),
          }),
        },
      }),
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
      '<div class="form-row"><label for="f-attendance">' + escapeHtml(t("entry.attendance")) + '</label><input type="number" inputmode="numeric" id="f-attendance" min="0" step="1" required placeholder="e.g. 18000"><div class="field-feedback" id="attendance-feedback"></div><div class="ref-note" id="attendance-ref-note"></div></div>' +
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

      var attNote = document.getElementById("attendance-ref-note");
      var est = estimateFor(meta.id);
      if (est) {
        attNote.innerHTML =
          escapeHtml(t("entry.ref.estimateLabel")) + " " + fmtNum(est.estimatedAttendance) + " (~" + fmtPct(est.percentChristian) + ") — " + escapeHtml(est.note) + ' <button type="button" class="link" id="use-ref-att">' + escapeHtml(t("entry.ref.use")) + "</button>";
        var attBtn = document.getElementById("use-ref-att");
        if (attBtn) {
          attBtn.addEventListener("click", function () {
            attendanceInput.value = est.estimatedAttendance;
            updateAttendanceFeedback();
          });
        }
      } else {
        attNote.innerHTML = "";
      }

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
            setView("registry", meta.id, "province");
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
      '<div class="back-link"><button class="link" id="back-to-province">&larr; ' + escapeHtml(registryBackLabel(meta)) + '</button></div>' +
      '<div class="card"><div class="loading">' + escapeHtml(t("registry.loading")) + '</div></div>';
    document.getElementById("back-to-province").addEventListener("click", function () {
      setView(state.registryFrom === "picker" ? "registry-picker" : "province", provinceId);
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
            return villageState(provinceId, v.code, status).hasChurch;
          }).length;
          var pendingHere = c.villages.filter(function (v) {
            return villageState(provinceId, v.code, status).source === "directory";
          }).length;
          var villagesHtml = c.villages
            .map(function (v) {
              var st = villageState(provinceId, v.code, status);
              var fromDirectory = st.source === "directory";
              return (
                '<div class="village-row' + (fromDirectory ? " from-directory" : "") + '" data-code="' +
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
                "</span>" +
                (fromDirectory ? ' <span class="from-directory-tag" title="' + escapeHtml(t("registry.fromDirectory.title")) + '">' + escapeHtml(t("registry.fromDirectory")) + "</span>" : "") +
                "</span>" +
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
            "<span>" + escapeHtml(lang === "km" ? c.khmer : c.latin) +
            (directoryHint(provinceId, c.code) || "") +
            (pendingHere ? ' <span class="pending-tag">' + pendingHere + " " + escapeHtml(t("registry.pendingConfirm")) + "</span>" : "") +
            ' <a class="maps-link" target="_blank" rel="noopener noreferrer" href="' +
            escapeHtml(mapsSearchUrl(meta, d.latin, c.latin)) +
            '" title="' + escapeHtml(t("registry.mapsSearch.title")) + '">' + escapeHtml(t("registry.mapsSearch")) + "</a>" +
            '</span><span class="count">' +
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
        return sum + c.villages.filter(function (v) { return villageState(provinceId, v.code, status).hasChurch; }).length;
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
    var pendingCount = directoryPendingCount(provinceId, status);

    appEl.innerHTML =
      '<div class="back-link"><button class="link" id="back-to-province">&larr; ' + escapeHtml(registryBackLabel(meta)) + '</button></div>' +
      '<div class="card">' +
      '<div class="section-title">' + escapeHtml(t("registry.title")) + " — " + escapeHtml(provinceName(meta)) + '</div>' +
      '<div class="section-sub">' + escapeHtml(t("registry.sub")) + '</div>' +
      '<div class="registry-summary-bar"><div><div class="registry-summary-figure" id="registry-summary-figure">' +
      churchCount +
      " " + escapeHtml(t("registry.of")) + " " + hierarchy.villageCount + " " + escapeHtml(villagesHaveChurchLabel(churchCount)) +
      '</div><div class="stat-foot">' + hierarchy.districtCount + ' ' + escapeHtml(t("registry.district")).toLowerCase() + 's · ' + hierarchy.communeCount + ' ' + escapeHtml(t("registry.commune")).toLowerCase() + 's</div></div>' +
      (pendingCount
        ? '<button class="pill-link" id="confirm-directory">' + escapeHtml(t("registry.confirmAll")).replace("{n}", pendingCount) + "</button>"
        : "") +
      "</div>" +
      (pendingCount
        ? '<p class="directory-explainer">' + escapeHtml(t("registry.directoryExplainer")) + "</p>"
        : "") +
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
      setView(state.registryFrom === "picker" ? "registry-picker" : "province", provinceId);
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

    var confirmBtn = document.getElementById("confirm-directory");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        var dir = (window.CHURCH_COUNTS[provinceId] || {}).villages || {};
        var entries = Object.keys(dir)
          .filter(function (code) { return !status[code]; })
          .map(function (code) { return { villageCode: code, hasChurch: true, note: dir[code].church || "" }; });
        if (!entries.length) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = t("registry.confirming");
        fetch("/api/villages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provinceId: provinceId,
            entries: entries,
            passcode: passcodeInput.value,
            updatedBy: remembered(REMEMBER_NAME_KEY),
          }),
        })
          .then(function (res) {
            if (!res.ok) return res.json().then(function (b) { throw new Error(b.error || "Save failed"); });
            return res.json();
          })
          .then(function () {
            entries.forEach(function (e) { status[e.villageCode] = { hasChurch: true, note: e.note }; });
            state.villageStatus[provinceId] = status;
            remember(REMEMBER_PASSCODE_KEY, passcodeInput.value);
            render();
          })
          .catch(function () {
            confirmBtn.disabled = false;
            confirmBtn.textContent = t("registry.confirmAll").replace("{n}", entries.length);
            alert(t("registry.saveError"));
          });
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
