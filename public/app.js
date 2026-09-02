// Vision 2033 — one report per province.
//
// A province's church leader sends two figures: roughly how many Christians are in
// their province, and how many of its villages have a church. The village total is
// official (NCDD gazetteer) and filled in for them, so they only estimate the share.
(function () {
  "use strict";

  var t = window.I18N.t;
  var provinceName = window.I18N.provinceName;
  var PROVINCES = window.PROVINCES || [];
  var GOAL = window.GOAL || { targetPercent: 10, targetDate: "2033-01-01" };
  var GATHERED = (window.GATHERED_2026 && window.GATHERED_2026.byProvince) || {};
  var PASSCODE_KEY = "vision2033.passcode";
  var TOKEN_KEY = "vision2033.token";

  var state = {
    view: "dashboard",
    loading: true,
    error: "",
    byProvince: {},
    confidence: 0,
    sending: false,
    formError: "",
    sent: false,
    // Held in state, not left in the DOM: a validation error re-renders the form,
    // and a leader who mistyped one field should not lose the other four.
    form: { provinceId: "", christians: "", villages: "", name: "", passcode: "" },

    // Village registry
    regCounts: {}, // provinceId -> villages confirmed as having a church
    regProvince: null,
    regData: null, // the province's district/commune/village tree
    regStatuses: {}, // villageCode -> { hasChurch }
    regLoading: false,
    regError: "",
    regFilter: "",
    regOpen: {}, // district/commune code -> expanded
    regBusy: {}, // villageCode -> mid-save

    // My Church — the signed-in account and everything that screen shows
    ch: {
      token: "",
      me: null,
      leader: null,
      director: null,
      leaderMissing: false,
      roster: null,
      rosterScope: "",
      tally: null,
      loading: false,
      busy: false,
      error: "",
      notice: "",
      mode: "signin",
      auth: { phone: "", pin: "", pin2: "", name: "", code: "", provinceId: "" },
      form: { provinceId: "", churchName: "", denomination: "", men: "", women: "", children: "" },
      villages: [],
      tree: null,
      treeFor: "",
      vilFilter: "",
      pinOpen: false,
      pin: { current: "", next: "" },
    },
  };

  var app = document.getElementById("app");

  // ---------- helpers ----------

  function fmt(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  function pct(n, of) {
    if (!of) return "—";
    return ((n / of) * 100).toFixed(2) + "%";
  }

  function provinceById(id) {
    for (var i = 0; i < PROVINCES.length; i++) if (PROVINCES[i].id === id) return PROVINCES[i];
    return null;
  }

  // Older submissions stored the figure as `sundayAttendance`; read either.
  function christiansOf(entry) {
    if (!entry) return 0;
    var v = entry.christians;
    if (v === null || v === undefined) v = entry.sundayAttendance;
    return Number(v) || 0;
  }

  function villagesOf(entry) {
    return Number(entry && entry.villagesWithChurches) || 0;
  }

  function confBand(c) {
    if (c >= 8) return t("conf.high");
    if (c >= 4) return t("conf.mid");
    return t("conf.low");
  }

  function yearsLeft() {
    var target = new Date(GOAL.targetDate).getTime();
    var years = (target - Date.now()) / (365.25 * 24 * 3600 * 1000);
    return Math.max(0, years);
  }

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Everything both the dashboard and the 2033 view need, derived once.
  function totals() {
    var reported = [];
    var christians = 0;
    var population = 0;
    var villagesWithChurches = 0;
    var villagesTotal = 0;

    PROVINCES.forEach(function (p) {
      var entry = state.byProvince[p.id];
      if (!entry) return;
      var c = christiansOf(entry);
      var v = villagesOf(entry);
      reported.push({ province: p, entry: entry, christians: c, villages: v });
      christians += c;
      population += p.referencePopulation || 0;
      villagesWithChurches += v;
      villagesTotal += p.referenceVillages || 0;
    });

    return {
      reported: reported,
      christians: christians,
      population: population,
      villagesWithChurches: villagesWithChurches,
      villagesTotal: villagesTotal,
    };
  }

  // ---------- data ----------

  // Every network call goes through here so none of them can hang forever.
  // Provincial mobile data drops out mid-request often enough that a bare fetch()
  // leaves a leader staring at a spinner or a stuck "Sending…" with no way back.
  // 20s is generous for a slow 3G round trip and still short enough to feel like
  // an answer. On abort this rejects, so existing .catch() branches show the
  // "check your connection" message they were already written for.
  var REQUEST_TIMEOUT_MS = 20000;

  function req(url, opts) {
    if (typeof AbortController !== "function") return fetch(url, opts);
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      ctrl.abort();
    }, REQUEST_TIMEOUT_MS);
    var o = {};
    for (var k in opts || {}) if (opts.hasOwnProperty(k)) o[k] = opts[k];
    o.signal = ctrl.signal;
    return fetch(url, o).then(
      function (r) {
        clearTimeout(timer);
        return r;
      },
      function (e) {
        clearTimeout(timer);
        throw e;
      }
    );
  }

  // silent = refresh in place, without flashing the loading state over data
  // that's already on screen.
  function load(silent) {
    if (!silent) {
      state.loading = true;
      render();
    }
    Promise.all([
      req("/api/entries")
        .then(function (r) {
          return r.json();
        })
        .catch(function () {
          return null;
        }),
      // Registry totals ride along, so the dashboard can show confirmed
      // alongside estimated without a second round trip.
      req("/api/villages?summary=1")
        .then(function (r) {
          return r.json();
        })
        .catch(function () {
          return null;
        }),
    ]).then(function (res) {
      var data = res[0];
      var summary = res[1];
      if (data) {
        var map = {};
        (data.provinces || []).forEach(function (p) {
          var latest = (p.history || [])[0];
          if (latest) map[p.id] = latest;
        });
        state.byProvince = map;
      }
      if (summary && summary.counts) state.regCounts = summary.counts;
      state.loading = false;
      state.error = data ? "" : t("err.generic");
      render();
    });
  }

  function confirmedTotal() {
    var n = 0;
    for (var k in state.regCounts) if (state.regCounts.hasOwnProperty(k)) n += state.regCounts[k] || 0;
    return n;
  }

  // The 2026 national committee roster's church-membership figure for a province, or null
  // if that province's roll-up row was left blank in the source spreadsheet.
  function gatheredOf(provinceId) {
    var g = GATHERED[provinceId];
    if (!g || g.members === null || g.members === undefined) return null;
    return Number(g.members) || 0;
  }

  function gatheredTotals() {
    var total = 0;
    var count = 0;
    PROVINCES.forEach(function (p) {
      var m = gatheredOf(p.id);
      if (m !== null) {
        total += m;
        count++;
      }
    });
    return { total: total, count: count };
  }

  // ---------- estimated vs. gathered ----------
  //
  // The leader's own Submit estimate, next to the 2026 national committee roster's
  // membership figure for the same province. Two independent counts, shown side by
  // side rather than merged into one number — same principle as estimated vs.
  // confirmed villages above.

  function renderComparison() {
    if (!Object.keys(GATHERED).length) return;

    var rows = PROVINCES.map(function (p) {
      var entry = state.byProvince[p.id];
      return {
        province: p,
        estimated: entry ? christiansOf(entry) : null,
        gathered: gatheredOf(p.id),
      };
    }).filter(function (r) {
      return r.estimated !== null || r.gathered !== null;
    });

    if (!rows.length) return;

    rows.sort(function (a, b) {
      return (b.gathered || 0) - (a.gathered || 0);
    });

    var body =
      '<div class="row row-head">' +
      "<div>" + esc(t("table.province")) + "</div>" +
      '<div style="text-align:right">' + esc(t("compare.estimated")) + "</div>" +
      '<div style="text-align:right">' + esc(t("compare.gathered")) + "</div>" +
      "</div>";

    rows.forEach(function (r) {
      var diff = r.estimated !== null && r.gathered !== null ? r.gathered - r.estimated : null;
      body +=
        '<div class="row">' +
        '<div class="row-name">' + esc(provinceName(r.province)) +
        (diff !== null
          ? '<div class="row-by">' + (diff > 0 ? "+" : "") + fmt(diff) + " " + esc(t("compare.diff")) + "</div>"
          : "") +
        "</div>" +
        '<div class="row-num num">' + (r.estimated !== null ? fmt(r.estimated) : "—") + "</div>" +
        '<div class="row-num num">' + (r.gathered !== null ? fmt(r.gathered) : "—") + "</div>" +
        "</div>";
    });

    var source = window.GATHERED_2026 && window.GATHERED_2026.source;
    var sourceLabel = source && (window.I18N.getLang() === "km" ? source.labelKhmer || source.label : source.label);

    app.appendChild(
      el(
        '<div class="card">' +
          '<div class="reg-title">' + esc(t("compare.title")) + "</div>" +
          '<div class="goal-scope" style="text-align:left;margin:6px 0 12px">' +
          esc(t("compare.intro")) +
          "</div>" +
          '<div class="rows">' + body + "</div>" +
          (sourceLabel
            ? '<div class="goal-scope" style="margin-top:10px">' +
              esc(t("compare.source")) + " " + esc(sourceLabel) +
              "</div>"
            : "") +
          "</div>"
      )
    );
  }

  // ---------- dashboard ----------

  function renderDashboard() {
    var s = totals();

    // Independent of whether any province has self-reported yet, since the roster's
    // figures come from a separate source entirely.
    renderComparison();

    if (!s.reported.length) {
      app.appendChild(
        el(
          '<div class="card empty">' +
            "<h2>" + esc(t("dash.empty.title")) + "</h2>" +
            "<p>" + esc(t("dash.empty.body")) + "</p>" +
            '<button class="btn" data-go="submit">' + esc(t("dash.cta")) + "</button>" +
            "</div>"
        )
      );
      return;
    }

    s.reported.sort(function (a, b) {
      return b.christians - a.christians;
    });

    app.appendChild(
      el(
        '<div class="card headline">' +
          '<div class="headline-num num">' + fmt(s.christians) + "</div>" +
          '<div class="headline-label">' + esc(t("dash.total")) + "</div>" +
          '<div class="headline-sub">' +
          esc(t("dash.from")) + " " + s.reported.length + " " + esc(t("dash.ofProvinces")) +
          " · " + pct(s.christians, s.population) + " " + esc(t("dash.percent")) +
          "</div>" +
          (s.villagesTotal
            ? '<div class="headline-sub">' +
              '<strong class="num">' + fmt(s.villagesWithChurches) + "</strong> " +
              esc(t("dash.from")) + ' <span class="num">' + fmt(s.villagesTotal) + "</span> " +
              esc(t("dash.villagesLine")) + " — " + esc(t("reg.estimated")) +
              "</div>"
            : "") +
          // The registry's own count, kept separate rather than blended in: one is a
          // leader's estimate, the other is village-by-village confirmation.
          (confirmedTotal()
            ? '<div class="headline-sub">' +
              '<strong class="num">' + fmt(confirmedTotal()) + "</strong> " +
              esc(t("reg.confirmed")) +
              "</div>"
            : "") +
          // A third, independent count — the 2026 committee roster's own membership
          // figures — shown but never added into the total above.
          (gatheredTotals().count
            ? '<div class="headline-sub">' +
              '<strong class="num">' + fmt(gatheredTotals().total) + "</strong> " +
              esc(t("dash.gatheredLine")) +
              "</div>"
            : "") +
          "</div>"
      )
    );

    var rows =
      '<div class="row row-head">' +
      "<div>" + esc(t("table.province")) + "</div>" +
      '<div style="text-align:right">' + esc(t("table.christians")) + "</div>" +
      '<div style="text-align:right">' + esc(t("table.confidence")) + "</div>" +
      "</div>";

    s.reported.forEach(function (r) {
      var conf = Number(r.entry.confidence) || 0;
      var pips = "";
      for (var i = 1; i <= 10; i++) pips += '<span class="conf-pip' + (i <= conf ? " on" : "") + '"></span>';

      var sub = [];
      if (r.entry.enteredBy) sub.push(esc(t("dash.by")) + " " + esc(r.entry.enteredBy));
      if (r.province.referenceVillages) {
        sub.push(
          '<span class="num">' + fmt(r.villages) + "/" + fmt(r.province.referenceVillages) +
            "</span> " + esc(t("table.villages"))
        );
      }

      rows +=
        '<div class="row">' +
        '<div class="row-name">' + esc(provinceName(r.province)) +
        (sub.length ? '<div class="row-by">' + sub.join(" · ") + "</div>" : "") +
        "</div>" +
        '<div class="row-num num">' + fmt(r.christians) +
        '<div class="row-pct num">' + pct(r.christians, r.province.referencePopulation) + "</div>" +
        "</div>" +
        '<div class="conf">' + pips + '<span class="conf-val num">' + (conf ? conf + "/10" : "—") + "</span></div>" +
        "</div>";
    });

    app.appendChild(el('<div class="card"><div class="rows">' + rows + "</div></div>"));

    var missing = PROVINCES.filter(function (p) {
      return !state.byProvince[p.id];
    });
    if (missing.length) {
      app.appendChild(
        el(
          '<div class="card waiting">' +
            "<strong>" + esc(t("dash.waiting")) + " (" + missing.length + ")</strong>" +
            esc(missing.map(provinceName).join(" · ")) +
            "</div>"
        )
      );
    }
  }

  // ---------- 2033 ----------

  function renderGoal() {
    var s = totals();

    if (!s.reported.length) {
      app.appendChild(
        el('<div class="card empty"><h2>' + esc(t("goal.title")) + "</h2><p>" + esc(t("goal.empty")) + "</p></div>")
      );
      return;
    }

    var currentPct = s.population ? (s.christians / s.population) * 100 : 0;
    var targetPct = GOAL.targetPercent || 10;
    var targetCount = Math.round((s.population * targetPct) / 100);
    var needed = Math.max(0, targetCount - s.christians);
    var years = yearsLeft();
    var perYear = years > 0 ? Math.round(needed / years) : needed;
    var barPct = Math.max(1, Math.min(100, (currentPct / targetPct) * 100));

    app.appendChild(
      el(
        '<div class="card">' +
          '<div class="goal-heads">' +
          '<div><div class="goal-num num">' + currentPct.toFixed(2) + "%</div>" +
          '<div class="goal-cap">' + esc(t("goal.now")) + "</div></div>" +
          '<div><div class="goal-num goal-num-muted num">' + targetPct + "%</div>" +
          '<div class="goal-cap">' + esc(t("goal.target")) + "</div></div>" +
          '<div><div class="goal-num goal-num-muted num">' + Math.round(years) + "</div>" +
          '<div class="goal-cap">' + esc(t("goal.years")) + "</div></div>" +
          "</div>" +
          '<div class="goal-bar"><span style="width:' + barPct.toFixed(1) + '%"></span></div>' +
          '<div class="goal-scope">' + esc(t("goal.scope")) + "</div>" +
          "</div>"
      )
    );

    app.appendChild(
      el(
        '<div class="card">' +
          '<div class="stat"><div class="stat-num num">' + fmt(needed) + "</div>" +
          '<div class="stat-cap">' + esc(t("goal.needed")) + "</div></div>" +
          '<div class="stat"><div class="stat-num num">' + fmt(perYear) + "</div>" +
          '<div class="stat-cap">' + esc(t("goal.perYear")) + "</div></div>" +
          (s.villagesTotal
            ? '<div class="stat"><div class="stat-num num">' +
              fmt(s.villagesTotal - s.villagesWithChurches) + "</div>" +
              '<div class="stat-cap">' + esc(t("goal.villagesNone")) + "</div></div>"
            : "") +
          "</div>"
      )
    );

    app.appendChild(el('<div class="card waiting">' + esc(t("goal.partial")) + "</div>"));
  }

  // ---------- village registry ----------
  //
  // 14,372 villages nationally, so nothing renders that isn't being looked at:
  // districts and communes stay collapsed until opened, and search replaces the
  // tree rather than adding to it.

  var regPass = "";

  function passcodeValue() {
    if (regPass) return regPass;
    try {
      return localStorage.getItem(PASSCODE_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function locName(o) {
    return window.I18N.getLang() === "km" ? o.khmer || o.latin : o.latin || o.khmer;
  }

  function isMarked(code) {
    return !!(state.regStatuses[code] && state.regStatuses[code].hasChurch);
  }

  function communeMarked(c) {
    var n = 0;
    c.villages.forEach(function (v) {
      if (isMarked(v.code)) n++;
    });
    return n;
  }

  function districtCounts(d) {
    var marked = 0;
    var total = 0;
    d.communes.forEach(function (c) {
      marked += communeMarked(c);
      total += c.villages.length;
    });
    return { marked: marked, total: total };
  }

  function provinceMarked() {
    var n = 0;
    for (var code in state.regStatuses)
      if (state.regStatuses.hasOwnProperty(code) && state.regStatuses[code].hasChurch) n++;
    return n;
  }

  function openRegistryProvince(id) {
    state.regProvince = id;
    state.regData = null;
    state.regStatuses = {};
    state.regOpen = {};
    state.regFilter = "";
    state.regError = "";
    state.regLoading = true;
    render();

    Promise.all([
      req("/data/villages/" + encodeURIComponent(id) + ".json")
        .then(function (r) {
          return r.json();
        })
        .catch(function () {
          return null;
        }),
      req("/api/villages?province=" + encodeURIComponent(id))
        .then(function (r) {
          return r.json();
        })
        .catch(function () {
          return null;
        }),
    ]).then(function (res) {
      state.regData = res[0];
      state.regStatuses = (res[1] && res[1].statuses) || {};
      state.regLoading = false;
      if (!res[0]) state.regError = t("err.generic");
      render();
    });
  }

  function villageRow(v, where) {
    return (
      '<div class="vil' + (isMarked(v.code) ? " on" : "") + (state.regBusy[v.code] ? " busy" : "") +
      '" data-vil="' + esc(v.code) + '">' +
      '<span class="vil-box">✓</span>' +
      '<span class="vil-name">' + esc(locName(v)) +
      (where ? '<span class="vil-where"> · ' + esc(where) + "</span>" : "") +
      "</span>" +
      "</div>"
    );
  }

  var SEARCH_CAP = 150;

  function regListHtml() {
    if (!state.regData) return "";
    var q = state.regFilter.trim().toLowerCase();

    if (q) {
      var hits = [];
      state.regData.districts.forEach(function (d) {
        d.communes.forEach(function (c) {
          c.villages.forEach(function (v) {
            var hay = (
              (v.latin || "") + " " + (v.khmer || "") + " " + (c.latin || "") + " " + (c.khmer || "")
            ).toLowerCase();
            if (hay.indexOf(q) !== -1) hits.push({ v: v, where: locName(c) });
          });
        });
      });
      if (!hits.length) return '<div class="waiting">' + esc(t("reg.noResults")) + "</div>";
      var shown = hits.slice(0, SEARCH_CAP);
      return (
        shown
          .map(function (h) {
            return villageRow(h.v, h.where);
          })
          .join("") +
        (hits.length > SEARCH_CAP
          ? '<div class="waiting" style="padding-top:12px">' +
            (hits.length - SEARCH_CAP) + " " + esc(t("reg.more")) + "</div>"
          : "")
      );
    }

    return state.regData.districts
      .map(function (d) {
        var dc = districtCounts(d);
        var open = !!state.regOpen[d.code];
        var body = "";
        if (open) {
          body = d.communes
            .map(function (c) {
              var cOpen = !!state.regOpen[c.code];
              return (
                '<div class="node node-commune">' +
                '<button class="node-head" data-exp="' + esc(c.code) + '">' +
                '<span class="node-caret">' + (cOpen ? "▾" : "▸") + "</span>" +
                '<span class="node-name">' + esc(locName(c)) + "</span>" +
                '<span class="node-sub num">' + communeMarked(c) + "/" + c.villages.length + "</span>" +
                "</button>" +
                (cOpen
                  ? '<div class="node-body">' +
                    c.villages
                      .map(function (v) {
                        return villageRow(v, "");
                      })
                      .join("") +
                    "</div>"
                  : "") +
                "</div>"
              );
            })
            .join("");
        }
        return (
          '<div class="node">' +
          '<button class="node-head" data-exp="' + esc(d.code) + '">' +
          '<span class="node-caret">' + (open ? "▾" : "▸") + "</span>" +
          '<span class="node-name">' + esc(locName(d)) + "</span>" +
          '<span class="node-sub num">' + dc.marked + "/" + dc.total + "</span>" +
          "</button>" +
          (open ? '<div class="node-body">' + body + "</div>" : "") +
          "</div>"
        );
      })
      .join("");
  }

  // Update just the list and the header count, so typing in search keeps focus
  // and tapping a village doesn't jump the page.
  function refreshRegList() {
    var list = document.getElementById("reg-list");
    if (list) list.innerHTML = regListHtml();
    var p = provinceById(state.regProvince);
    var count = document.getElementById("reg-count");
    if (count && p) {
      count.textContent =
        provinceMarked() + " " + t("reg.of") + " " + fmt(p.referenceVillages) + " " + t("reg.marked");
    }
    var bar = document.getElementById("reg-bar");
    if (bar && p && p.referenceVillages) {
      bar.style.width = ((provinceMarked() / p.referenceVillages) * 100).toFixed(1) + "%";
    }
  }

  function toggleVillage(code) {
    if (state.regBusy[code]) return;
    var pass = passcodeValue();
    if (!pass) {
      state.regError = t("err.passcode");
      render();
      return;
    }

    var was = isMarked(code);
    var next = !was;
    state.regBusy[code] = true;
    if (next) state.regStatuses[code] = { hasChurch: true };
    else delete state.regStatuses[code];
    state.regError = "";
    refreshRegList();

    req("/api/villages", {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        passcode: pass,
        provinceId: state.regProvince,
        villageCode: code,
        hasChurch: next,
      }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("save failed");
        return r.json();
      })
      .then(function () {
        delete state.regBusy[code];
        state.regCounts[state.regProvince] = provinceMarked();
        try {
          localStorage.setItem(PASSCODE_KEY, pass);
        } catch (e) {}
        refreshRegList();
      })
      .catch(function () {
        delete state.regBusy[code];
        // Put it back the way it was — the server is the source of truth.
        if (was) state.regStatuses[code] = { hasChurch: true };
        else delete state.regStatuses[code];
        state.regError = t("reg.saveError");
        render();
      });
  }

  function renderRegistry() {
    // Province picker
    if (!state.regProvince) {
      app.appendChild(
        el(
          '<div class="card">' +
            '<div class="reg-title">' + esc(t("reg.pick")) + "</div>" +
            '<div class="goal-scope" style="text-align:left;margin-top:6px">' +
            esc(t("reg.intro")) + "</div>" +
            "</div>"
        )
      );

      var cards = PROVINCES.map(function (p) {
        var marked = state.regCounts[p.id] || 0;
        var total = p.referenceVillages || 0;
        var w = total ? Math.min(100, (marked / total) * 100) : 0;
        return (
          '<button class="prov-card" data-reg-open="' + esc(p.id) + '">' +
          '<div class="prov-card-name">' + esc(provinceName(p)) + "</div>" +
          '<div class="prov-card-sub"><span class="num">' + fmt(marked) + "</span> " +
          esc(t("reg.of")) + ' <span class="num">' + fmt(total) + "</span> " + esc(t("reg.marked")) +
          "</div>" +
          '<div class="mini-bar"><span style="width:' + w.toFixed(1) + '%"></span></div>' +
          "</button>"
        );
      }).join("");

      app.appendChild(el('<div class="prov-grid">' + cards + "</div>"));
      return;
    }

    var p = provinceById(state.regProvince);
    var marked = provinceMarked();
    var total = (p && p.referenceVillages) || 0;

    app.appendChild(
      el(
        '<div class="card">' +
          '<button class="btn-link" style="padding:0 0 8px" data-reg-back="1">← ' +
          esc(t("reg.back")) + "</button>" +
          '<div class="reg-head">' +
          '<span class="reg-title">' + esc(p ? provinceName(p) : "") + "</span>" +
          '<span class="reg-count num" id="reg-count">' +
          marked + " " + esc(t("reg.of")) + " " + fmt(total) + " " + esc(t("reg.marked")) +
          "</span>" +
          "</div>" +
          '<div class="mini-bar"><span id="reg-bar" style="width:' +
          (total ? ((marked / total) * 100).toFixed(1) : 0) + '%"></span></div>' +
          "</div>"
      )
    );

    if (!passcodeValue()) {
      app.appendChild(
        el(
          '<div class="card"><div class="field" style="margin:0">' +
            '<label class="label" for="reg-pass">' + esc(t("reg.passcode")) + "</label>" +
            '<input id="reg-pass" type="password" value="" placeholder="' +
            esc(t("submit.passcode.placeholder")) + '" />' +
            "</div></div>"
        )
      );
    }

    if (state.regError) app.appendChild(el('<div class="error">' + esc(state.regError) + "</div>"));

    if (state.regLoading) {
      app.appendChild(el('<div class="loading">…</div>'));
      return;
    }
    if (!state.regData) return;

    app.appendChild(
      el(
        '<div class="card">' +
          '<input class="reg-search" id="reg-search" type="text" placeholder="' +
          esc(t("reg.search")) + '" value="' + esc(state.regFilter) + '" />' +
          '<div id="reg-list">' + regListHtml() + "</div>" +
          "</div>"
      )
    );
  }

  // ---------- submit ----------

  function renderSubmit() {
    if (state.sent) {
      app.appendChild(
        el(
          '<div class="card success">' +
            '<div class="success-mark">✓</div>' +
            "<h2>" + esc(t("submit.thanks")) + "</h2>" +
            '<button class="btn-link" data-again="1">' + esc(t("submit.again")) + "</button>" +
            "</div>"
        )
      );
      return;
    }

    var f = state.form;
    var chosen = provinceById(f.provinceId);

    var options = '<option value="">' + esc(t("submit.choose")) + "</option>";
    PROVINCES.forEach(function (p) {
      options +=
        '<option value="' + esc(p.id) + '"' + (p.id === f.provinceId ? " selected" : "") + ">" +
        esc(provinceName(p)) + "</option>";
    });

    var villageNote = chosen && chosen.referenceVillages
      ? esc(t("submit.villages.has")) + ' <strong class="num">' + fmt(chosen.referenceVillages) +
        "</strong> " + esc(t("submit.villages.total"))
      : esc(t("submit.villages.pick"));

    var confBtns = "";
    for (var i = 1; i <= 10; i++) {
      confBtns +=
        '<button type="button" class="conf-btn' + (state.confidence === i ? " on" : "") +
        '" data-conf="' + i + '">' + i + "</button>";
    }

    var savedPass = "";
    try {
      savedPass = localStorage.getItem(PASSCODE_KEY) || "";
    } catch (e) {}

    // A signed-in provincial leader is already authenticated. Asking them for the
    // shared passcode as well would be asking for a second credential to prove
    // something the session has already proved.
    var bySession = signedIn() && isLeader();

    var card =
      '<div class="card">' +
      (state.formError ? '<div class="error">' + esc(state.formError) + "</div>" : "") +
      '<div class="field">' +
      '<label class="label" for="f-province">' + esc(t("submit.province")) + "</label>" +
      '<select id="f-province">' + options + "</select>" +
      "</div>" +
      '<div class="field">' +
      '<label class="label" for="f-christians">' + esc(t("submit.howMany")) +
      ' <span class="label-hint">— ' + esc(t("submit.howMany.hint")) + "</span></label>" +
      '<input class="big" id="f-christians" type="number" inputmode="numeric" min="0" step="1" placeholder="0" value="' +
      esc(f.christians) + '" />' +
      "</div>" +
      '<div class="field">' +
      '<label class="label" for="f-villages">' + esc(t("submit.villages")) + "</label>" +
      '<div class="field-note" id="villages-note">' + villageNote + "</div>" +
      '<input class="big" id="f-villages" type="number" inputmode="numeric" min="0" step="1" placeholder="0" value="' +
      esc(f.villages) + '"' +
      (chosen && chosen.referenceVillages ? ' max="' + chosen.referenceVillages + '"' : " disabled") +
      " />" +
      "</div>" +
      '<div class="field">' +
      '<label class="label">' + esc(t("submit.confidence")) + "</label>" +
      '<div class="conf-grid" id="conf-grid">' + confBtns + "</div>" +
      '<div class="conf-caption" id="conf-caption">' +
      (state.confidence ? esc(confBand(state.confidence)) : "") +
      "</div>" +
      "</div>" +
      (bySession
        ? '<div class="field-note signed-as">' + esc(t("submit.as")) + " <strong>" +
          esc(state.ch.me.name) + "</strong></div>"
        : '<div class="field">' +
          '<label class="label" for="f-name">' + esc(t("submit.name")) + "</label>" +
          '<input id="f-name" type="text" value="' + esc(f.name) +
          '" placeholder="' + esc(t("submit.name.placeholder")) + '" />' +
          "</div>" +
          '<div class="field">' +
          '<label class="label" for="f-pass">' + esc(t("submit.passcode")) + "</label>" +
          '<input id="f-pass" type="password" value="' + esc(f.passcode || savedPass) +
          '" placeholder="' + esc(t("submit.passcode.placeholder")) + '" />' +
          "</div>") +
      '<button class="btn" id="f-submit"' + (state.sending ? " disabled" : "") + ">" +
      esc(state.sending ? t("submit.sending") : t("submit.button")) +
      "</button>" +
      "</div>";

    app.appendChild(el(card));
  }

  // The official village count is the app's to supply, not the leader's to remember.
  // Updated in place rather than by re-rendering, so nothing already typed is lost.
  function onProvinceChange() {
    state.form.provinceId = document.getElementById("f-province").value;
    var p = provinceById(state.form.provinceId);
    var note = document.getElementById("villages-note");
    var input = document.getElementById("f-villages");
    if (!note || !input) return;

    if (!p || !p.referenceVillages) {
      note.textContent = t("submit.villages.pick");
      input.value = "";
      state.form.villages = "";
      input.disabled = true;
      input.removeAttribute("max");
      return;
    }
    note.innerHTML =
      esc(t("submit.villages.has")) + ' <strong class="num">' + fmt(p.referenceVillages) +
      "</strong> " + esc(t("submit.villages.total"));
    input.disabled = false;
    input.max = String(p.referenceVillages);
  }

  var FIELD_OF = {
    "f-christians": "christians",
    "f-villages": "villages",
    "f-name": "name",
    "f-pass": "passcode",
  };

  var CH_FIELD = {
    "ch-church": "churchName",
    "ch-denom": "denomination",
  };
  var CH_NUM_FIELD = { "ch-men": "men", "ch-women": "women", "ch-children": "children" };
  var AUTH_FIELD = {
    "a-phone": "phone",
    "a-pin": "pin",
    "a-pin2": "pin2",
    "a-name": "name",
    "a-code": "code",
  };

  function syncField(e) {
    var key = FIELD_OF[e.target.id];
    if (key) state.form[key] = e.target.value;
  }

  function submit() {
    var provinceId = document.getElementById("f-province").value;
    var christiansRaw = document.getElementById("f-christians").value;
    var villagesRaw = document.getElementById("f-villages").value;
    var nameBox = document.getElementById("f-name");
    var passBox = document.getElementById("f-pass");
    // Both are absent when a signed-in leader is reporting — the session carries
    // the identity and the authorisation instead.
    var bySession = !passBox;
    var enteredBy = nameBox ? nameBox.value.trim() : state.ch.me ? state.ch.me.name : "";
    var passcode = passBox ? passBox.value : "";

    if (!provinceId) return fail(t("err.province"));
    if (christiansRaw === "" || !isFinite(Number(christiansRaw)) || Number(christiansRaw) < 0)
      return fail(t("err.number"));
    if (villagesRaw === "" || !isFinite(Number(villagesRaw)) || Number(villagesRaw) < 0)
      return fail(t("err.villages"));

    var p = provinceById(provinceId);
    if (p && p.referenceVillages && Number(villagesRaw) > p.referenceVillages)
      return fail(t("err.villagesMax"));
    if (!state.confidence) return fail(t("err.confidence"));
    if (!bySession && !passcode) return fail(t("err.passcode"));

    state.sending = true;
    state.formError = "";
    render();

    req("/api/entries", {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        passcode: passcode,
        provinceId: provinceId,
        provinceName: p ? p.name : provinceId,
        christians: Math.round(Number(christiansRaw)),
        villagesWithChurches: Math.round(Number(villagesRaw)),
        confidence: state.confidence,
        enteredBy: enteredBy,
      }),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          return { ok: r.ok, body: body };
        });
      })
      .then(function (res) {
        state.sending = false;
        if (!res.ok) {
          state.formError = res.body && res.body.error ? res.body.error : t("err.generic");
          render();
          return;
        }
        if (passcode) {
          try {
            localStorage.setItem(PASSCODE_KEY, passcode);
          } catch (e) {}
        }
        state.sent = true;
        state.confidence = 0;
        // Cleared for the next report; the passcode comes back from localStorage.
        state.form = { provinceId: "", christians: "", villages: "", name: "", passcode: "" };
        render();
        load(true);
      })
      .catch(function () {
        state.sending = false;
        state.formError = t("err.generic");
        render();
      });
  }

  function fail(msg) {
    state.formError = msg;
    render();
  }

  // ---------- My Church: accounts, profile, contacts, roster ----------

  // Suggestions only — the field is free text, because a list of Cambodian
  // denominations that a pastor can't find their own church in is worse than none.
  var DENOMINATIONS = [
    "Cambodian Evangelical Church",
    "Evangelical Fellowship of Cambodia",
    "Methodist",
    "Baptist",
    "Assemblies of God",
    "Presbyterian",
    "Christian and Missionary Alliance",
    "Foursquare",
    "Church of Christ",
    "Independent / non-denominational",
  ];

  function authHeaders(extra) {
    var h = extra || {};
    if (state.ch.token) h.authorization = "Bearer " + state.ch.token;
    return h;
  }

  function saveToken(token) {
    state.ch.token = token || "";
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function signedIn() {
    return Boolean(state.ch.token && state.ch.me);
  }

  function isLeader() {
    var r = state.ch.me && state.ch.me.role;
    return r === "leader" || r === "director";
  }

  // Fills the profile form from the saved record, so editing starts from what's
  // stored rather than from blank fields that would save away real numbers.
  function seedChurchForm(me) {
    state.ch.form = {
      provinceId: me.provinceId || "",
      churchName: me.churchName || "",
      denomination: me.denomination || "",
      men: me.congregation && me.congregation.men ? String(me.congregation.men) : "",
      women: me.congregation && me.congregation.women ? String(me.congregation.women) : "",
      children: me.congregation && me.congregation.children ? String(me.congregation.children) : "",
    };
    state.ch.villages = (me.villages || []).slice();
    // Whatever brought us here — signing up, signing in, or restoring a session on
    // load — the picker needs the province's villages before it can search them.
    if (me.provinceId) loadChurchTree(me.provinceId);
  }

  function loadMe(silent) {
    if (!state.ch.token) return;
    if (!silent) state.ch.loading = true;
    req("/api/me", { headers: authHeaders() })
      .then(function (r) {
        if (r.status === 401) {
          // The session expired or was signed with a secret that no longer matches.
          saveToken("");
          state.ch.me = null;
          throw new Error("expired");
        }
        return r.json();
      })
      .then(function (d) {
        state.ch.loading = false;
        state.ch.me = d.me;
        state.ch.leader = d.leader || null;
        state.ch.director = d.director || null;
        state.ch.leaderMissing = Boolean(d.leaderMissing);
        state.ch.roster = d.roster || null;
        state.ch.rosterScope = d.rosterScope || "";
        state.ch.tally = d.tally || null;
        seedChurchForm(d.me);
        if (state.view === "church") render();
      })
      .catch(function () {
        state.ch.loading = false;
        if (state.view === "church") render();
      });
  }

  function authSubmit() {
    var c = state.ch;
    var a = c.auth;
    c.error = "";

    if (!a.phone.trim()) return chFail(t("err.phone"));
    if (!/^\d{4,8}$/.test(a.pin)) return chFail(t("err.pin"));

    var body = { phone: a.phone, pin: a.pin };
    if (c.mode === "signup") {
      if (!a.name.trim()) return chFail(t("err.name"));
      if (a.pin !== a.pin2) return chFail(t("err.pinMatch"));
      if (!a.code.trim()) return chFail(t("err.passcode"));
      body.action = "signup";
      body.name = a.name;
      body.joinCode = a.code;
      body.provinceId = a.provinceId;
    } else {
      body.action = "signin";
    }

    c.busy = true;
    render();

    req("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        c.busy = false;
        if (!res.ok) {
          c.error = res.j && res.j.error ? res.j.error : t("err.generic");
          render();
          return;
        }
        saveToken(res.j.token);
        c.me = res.j.me;
        c.auth = { phone: "", pin: "", pin2: "", name: "", code: "", provinceId: "" };
        seedChurchForm(res.j.me);
        render();
        loadMe(true);
      })
      .catch(function () {
        c.busy = false;
        c.error = t("err.generic");
        render();
      });
  }

  function chFail(msg) {
    state.ch.error = msg;
    render();
  }

  function signOut() {
    saveToken("");
    state.ch.me = null;
    state.ch.leader = null;
    state.ch.director = null;
    state.ch.roster = null;
    state.ch.tally = null;
    state.ch.notice = "";
    state.ch.error = "";
    render();
  }

  function saveProfile() {
    var f = state.ch.form;
    var num = function (v) {
      var n = Number(v === "" ? 0 : v);
      return isFinite(n) && n >= 0 ? Math.round(n) : 0;
    };

    state.ch.busy = true;
    state.ch.error = "";
    state.ch.notice = "";
    render();

    req("/api/me", {
      method: "PUT",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        provinceId: f.provinceId,
        churchName: f.churchName,
        denomination: f.denomination,
        congregation: { men: num(f.men), women: num(f.women), children: num(f.children) },
        villages: state.ch.villages,
      }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        state.ch.busy = false;
        if (!res.ok) {
          state.ch.error = res.j && res.j.error ? res.j.error : t("err.generic");
          render();
          return;
        }
        state.ch.notice = t("church.saved");
        state.ch.me = res.j.me;
        render();
        // The notice belongs at the top of the card, but the Save button is at the
        // bottom — so without this a pastor taps Save and sees nothing happen.
        var n = document.querySelector(".notice");
        if (n && n.scrollIntoView) n.scrollIntoView({ block: "center" });
        // The province may have changed, which changes who their leader is.
        loadMe(true);
      })
      .catch(function () {
        state.ch.busy = false;
        state.ch.error = t("err.generic");
        render();
      });
  }

  function changePin() {
    var p = state.ch.pin;
    if (!/^\d{4,8}$/.test(p.next)) return chFail(t("err.pin"));
    state.ch.busy = true;
    state.ch.error = "";
    render();
    req("/api/me", {
      method: "PUT",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ currentPin: p.current, newPin: p.next }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        state.ch.busy = false;
        if (!res.ok) {
          state.ch.error = res.j && res.j.error ? res.j.error : t("err.generic");
        } else {
          state.ch.notice = t("church.pin.changed");
          state.ch.pinOpen = false;
          state.ch.pin = { current: "", next: "" };
        }
        render();
      })
      .catch(function () {
        state.ch.busy = false;
        state.ch.error = t("err.generic");
        render();
      });
  }

  function setRole(phone, role) {
    state.ch.busy = true;
    render();
    req("/api/me", {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ action: "setRole", phone: phone, role: role }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        state.ch.busy = false;
        if (!res.ok) state.ch.error = res.j && res.j.error ? res.j.error : t("err.generic");
        render();
        loadMe(true);
      })
      .catch(function () {
        state.ch.busy = false;
        state.ch.error = t("err.generic");
        render();
      });
  }

  // ---------- village picker ----------

  function loadChurchTree(provinceId) {
    if (!provinceId || state.ch.treeFor === provinceId) return;
    state.ch.treeFor = provinceId;
    state.ch.tree = null;
    req("/data/villages/" + encodeURIComponent(provinceId) + ".json")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        state.ch.tree = d;
        refreshChVil();
      })
      .catch(function () {});
  }

  function hasVillage(code) {
    for (var i = 0; i < state.ch.villages.length; i++) {
      if (state.ch.villages[i].code === code) return true;
    }
    return false;
  }

  var CH_VIL_CAP = 40;

  function chVilResultsHtml() {
    var q = state.ch.vilFilter.trim().toLowerCase();
    if (!q) return "";
    if (!state.ch.tree) return '<div class="pick-empty">…</div>';

    var hits = [];
    state.ch.tree.districts.forEach(function (d) {
      d.communes.forEach(function (c) {
        c.villages.forEach(function (v) {
          if (hits.length >= CH_VIL_CAP) return;
          if (hasVillage(v.code)) return;
          var hay = ((v.latin || "") + " " + (v.khmer || "")).toLowerCase();
          if (hay.indexOf(q) === -1) return;
          hits.push({ v: v, commune: c });
        });
      });
    });

    if (!hits.length) return '<div class="pick-empty">' + esc(t("reg.noResults")) + "</div>";

    return hits
      .map(function (h) {
        return (
          '<button type="button" class="pick-row" data-vil-add="' + esc(h.v.code) +
          '" data-vil-name="' + esc(h.v.latin || "") +
          '" data-vil-km="' + esc(h.v.khmer || "") +
          '" data-vil-commune="' + esc(locName(h.commune)) + '">' +
          "<span>" + esc(locName(h.v)) + "</span>" +
          '<span class="pick-where">' + esc(locName(h.commune)) + "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function chChipsHtml() {
    if (!state.ch.villages.length) {
      return '<div class="field-note">' + esc(t("church.villages.none")) + "</div>";
    }
    return (
      '<div class="chips">' +
      state.ch.villages
        .map(function (v) {
          var label = window.I18N.getLang() === "km" ? v.nameKhmer || v.name : v.name || v.nameKhmer;
          return (
            '<span class="chip">' + esc(label) +
            '<button type="button" class="chip-x" data-vil-del="' + esc(v.code) +
            '" aria-label="' + esc(t("church.villages.remove")) + '">×</button></span>'
          );
        })
        .join("") +
      "</div>"
    );
  }

  // Updated in place, like the registry list: re-rendering the whole screen on
  // each keystroke would take the keyboard focus away mid-word.
  function refreshChVil() {
    var chips = document.getElementById("ch-chips");
    var results = document.getElementById("ch-vil-results");
    if (chips) chips.innerHTML = chChipsHtml();
    if (results) results.innerHTML = chVilResultsHtml();
  }

  function chCongregationTotal() {
    var f = state.ch.form;
    return (Number(f.men) || 0) + (Number(f.women) || 0) + (Number(f.children) || 0);
  }

  function refreshChTotal() {
    var box = document.getElementById("ch-cong-total");
    if (box) box.textContent = fmt(chCongregationTotal());
  }

  // ---------- My Church views ----------

  function renderAuth() {
    var c = state.ch;
    var signup = c.mode === "signup";

    var options = '<option value="">' + esc(t("submit.choose")) + "</option>";
    PROVINCES.forEach(function (p) {
      options +=
        '<option value="' + esc(p.id) + '"' + (p.id === c.auth.provinceId ? " selected" : "") + ">" +
        esc(provinceName(p)) + "</option>";
    });

    var html =
      '<div class="card">' +
      "<h2>" + esc(signup ? t("auth.signup.title") : t("auth.signin.title")) + "</h2>" +
      '<p class="card-intro">' + esc(t("auth.intro")) + "</p>" +
      (c.error ? '<div class="error">' + esc(c.error) + "</div>" : "") +
      (signup
        ? '<div class="field">' +
          '<label class="label" for="a-name">' + esc(t("submit.name")) + "</label>" +
          '<input id="a-name" type="text" autocomplete="name" value="' + esc(c.auth.name) +
          '" placeholder="' + esc(t("submit.name.placeholder")) + '" />' +
          "</div>"
        : "") +
      '<div class="field">' +
      '<label class="label" for="a-phone">' + esc(t("auth.phone")) + "</label>" +
      '<input id="a-phone" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(c.auth.phone) +
      '" placeholder="' + esc(t("auth.phone.placeholder")) + '" />' +
      "</div>" +
      (signup
        ? '<div class="field">' +
          '<label class="label" for="a-province">' + esc(t("submit.province")) + "</label>" +
          '<select id="a-province">' + options + "</select>" +
          "</div>"
        : "") +
      '<div class="field">' +
      '<label class="label" for="a-pin">' + esc(t("auth.pin")) +
      (signup ? ' <span class="label-hint">— ' + esc(t("auth.pin.hint")) + "</span>" : "") +
      "</label>" +
      '<input id="a-pin" type="password" inputmode="numeric" autocomplete="' +
      (signup ? "new-password" : "current-password") + '" value="' + esc(c.auth.pin) + '" />' +
      "</div>" +
      (signup
        ? '<div class="field">' +
          '<label class="label" for="a-pin2">' + esc(t("auth.pin.confirm")) + "</label>" +
          '<input id="a-pin2" type="password" inputmode="numeric" autocomplete="new-password" value="' +
          esc(c.auth.pin2) + '" />' +
          "</div>" +
          '<div class="field">' +
          '<label class="label" for="a-code">' + esc(t("auth.code")) +
          ' <span class="label-hint">— ' + esc(t("auth.code.hint")) + "</span></label>" +
          '<input id="a-code" type="password" value="' + esc(c.auth.code) + '" />' +
          "</div>"
        : "") +
      '<button class="btn" id="a-go"' + (c.busy ? " disabled" : "") + ">" +
      esc(c.busy ? t("auth.working") : signup ? t("auth.signup.button") : t("auth.signin.button")) +
      "</button>" +
      '<button class="btn-link" id="a-mode">' +
      esc(signup ? t("auth.toSignin") : t("auth.toSignup")) +
      "</button>" +
      "</div>";

    app.appendChild(el(html));
  }

  function contactCard(label, person, extraNote) {
    if (!person) {
      return (
        '<div class="contact">' +
        '<div class="contact-label">' + esc(label) + "</div>" +
        '<div class="contact-none">' + esc(extraNote || "") + "</div>" +
        "</div>"
      );
    }
    return (
      '<div class="contact">' +
      '<div class="contact-label">' + esc(label) + "</div>" +
      '<div class="contact-name">' + esc(person.name) + "</div>" +
      (person.churchName ? '<div class="contact-sub">' + esc(person.churchName) + "</div>" : "") +
      '<a class="contact-call" href="tel:+' + esc(person.phone) + '">' +
      '<span class="contact-num">' + esc(person.phoneDisplay) + "</span>" +
      '<span class="contact-verb">' + esc(t("church.call")) + "</span>" +
      "</a>" +
      "</div>"
    );
  }

  function renderProfileCard() {
    var f = state.ch.form;
    var me = state.ch.me;

    var options = '<option value="">' + esc(t("submit.choose")) + "</option>";
    PROVINCES.forEach(function (p) {
      options +=
        '<option value="' + esc(p.id) + '"' + (p.id === f.provinceId ? " selected" : "") + ">" +
        esc(provinceName(p)) + "</option>";
    });

    var dl = DENOMINATIONS.map(function (d) {
      return '<option value="' + esc(d) + '"></option>';
    }).join("");

    var html =
      '<div class="card">' +
      '<div class="me-head">' +
      "<div>" +
      '<div class="me-name">' + esc(me.name) + "</div>" +
      '<div class="me-sub">' + esc(me.phoneDisplay) + "</div>" +
      "</div>" +
      '<span class="role-badge role-' + esc(me.role) + '">' + esc(t("role." + me.role)) + "</span>" +
      "</div>" +
      (state.ch.notice ? '<div class="notice">' + esc(state.ch.notice) + "</div>" : "") +
      (state.ch.error ? '<div class="error">' + esc(state.ch.error) + "</div>" : "") +
      "<h3>" + esc(t("church.profile")) + "</h3>" +
      '<div class="field">' +
      '<label class="label" for="ch-province">' + esc(t("submit.province")) + "</label>" +
      '<select id="ch-province">' + options + "</select>" +
      "</div>" +
      '<div class="field">' +
      '<label class="label" for="ch-church">' + esc(t("church.churchName")) + "</label>" +
      '<input id="ch-church" type="text" value="' + esc(f.churchName) +
      '" placeholder="' + esc(t("church.churchName.placeholder")) + '" />' +
      "</div>" +
      '<div class="field">' +
      '<label class="label" for="ch-denom">' + esc(t("church.denomination")) + "</label>" +
      '<input id="ch-denom" type="text" list="denoms" value="' + esc(f.denomination) +
      '" placeholder="' + esc(t("church.denomination.placeholder")) + '" />' +
      '<datalist id="denoms">' + dl + "</datalist>" +
      "</div>" +
      '<div class="field">' +
      '<label class="label">' + esc(t("church.congregation")) + "</label>" +
      '<div class="field-note">' + esc(t("church.congregation.hint")) + "</div>" +
      '<div class="cong-grid">' +
      '<label class="cong"><span>' + esc(t("church.men")) + "</span>" +
      '<input id="ch-men" type="number" inputmode="numeric" min="0" step="1" placeholder="0" value="' +
      esc(f.men) + '" /></label>' +
      '<label class="cong"><span>' + esc(t("church.women")) + "</span>" +
      '<input id="ch-women" type="number" inputmode="numeric" min="0" step="1" placeholder="0" value="' +
      esc(f.women) + '" /></label>' +
      '<label class="cong"><span>' + esc(t("church.children")) + "</span>" +
      '<input id="ch-children" type="number" inputmode="numeric" min="0" step="1" placeholder="0" value="' +
      esc(f.children) + '" /></label>' +
      "</div>" +
      '<div class="cong-total">' + esc(t("church.total")) +
      ' <strong class="num" id="ch-cong-total">' + fmt(chCongregationTotal()) + "</strong></div>" +
      "</div>" +
      '<div class="field">' +
      '<label class="label" for="ch-vil-search">' + esc(t("church.villages")) + "</label>" +
      '<div id="ch-chips">' + chChipsHtml() + "</div>" +
      (f.provinceId
        ? '<input class="reg-search" id="ch-vil-search" type="text" placeholder="' +
          esc(t("church.villages.search")) + '" value="' + esc(state.ch.vilFilter) + '" />' +
          '<div class="pick-results" id="ch-vil-results">' + chVilResultsHtml() + "</div>"
        : '<div class="field-note">' + esc(t("church.villages.pickProvince")) + "</div>") +
      "</div>" +
      '<button class="btn" id="ch-save"' + (state.ch.busy ? " disabled" : "") + ">" +
      esc(state.ch.busy ? t("church.saving") : t("church.save")) +
      "</button>" +
      '<div class="card-foot">' +
      '<button class="btn-link" id="ch-pin-toggle">' + esc(t("church.pin.change")) + "</button>" +
      '<button class="btn-link" id="ch-signout">' + esc(t("auth.signout")) + "</button>" +
      "</div>" +
      (state.ch.pinOpen
        ? '<div class="pin-box">' +
          '<div class="field"><label class="label" for="ch-pin-cur">' +
          esc(t("church.pin.current")) + "</label>" +
          '<input id="ch-pin-cur" type="password" inputmode="numeric" value="' +
          esc(state.ch.pin.current) + '" /></div>' +
          '<div class="field"><label class="label" for="ch-pin-new">' +
          esc(t("church.pin.new")) + "</label>" +
          '<input id="ch-pin-new" type="password" inputmode="numeric" value="' +
          esc(state.ch.pin.next) + '" /></div>' +
          '<button class="btn btn-quiet" id="ch-pin-save">' + esc(t("church.save")) + "</button>" +
          "</div>"
        : "") +
      "</div>";

    app.appendChild(el(html));
  }

  function renderContactsCard() {
    var c = state.ch;
    var leaderNote = c.me.provinceId ? t("church.leader.none") : t("church.setProvince");

    var html =
      '<div class="card">' +
      "<h3>" + esc(t("church.contacts")) + "</h3>" +
      (c.me.role === "leader"
        ? '<div class="contact"><div class="contact-label">' + esc(t("church.leader")) + "</div>" +
          '<div class="contact-none">' + esc(t("church.you")) + "</div></div>"
        : contactCard(t("church.leader"), c.leader, leaderNote)) +
      (c.me.role === "director"
        ? '<div class="contact"><div class="contact-label">' + esc(t("church.director")) + "</div>" +
          '<div class="contact-none">' + esc(t("church.you")) + "</div></div>"
        : contactCard(t("church.director"), c.director, t("dash.waiting"))) +
      "</div>";

    app.appendChild(el(html));
  }

  function renderRosterCard() {
    var c = state.ch;
    var all = c.rosterScope === "all";
    var rows = c.roster || [];

    // A director sees everyone; a leader sees their own province. Either way the
    // headline figure is the one that bears on the province total in front of them.
    var tally = (c.tally && c.tally[c.me.provinceId]) || null;
    var scopeTally = tally;
    if (all) {
      scopeTally = { men: 0, women: 0, children: 0, total: 0, churches: 0 };
      for (var k in c.tally || {}) {
        if (!c.tally.hasOwnProperty(k)) continue;
        scopeTally.men += c.tally[k].men;
        scopeTally.women += c.tally[k].women;
        scopeTally.children += c.tally[k].children;
        scopeTally.total += c.tally[k].total;
        scopeTally.churches += c.tally[k].churches;
      }
    }

    var entry = state.byProvince[c.me.provinceId];
    var reported = entry ? christiansOf(entry) : 0;

    var head =
      '<div class="card">' +
      "<h3>" + esc(all ? t("roster.titleAll") : t("roster.title")) + "</h3>" +
      '<p class="card-intro">' + esc(t("roster.intro")) + "</p>";

    if (scopeTally && scopeTally.total > 0) {
      head +=
        '<div class="tally">' +
        '<div class="tally-num">' + fmt(scopeTally.total) + "</div>" +
        '<div class="tally-label">' + esc(t("roster.sum")) + " · " +
        fmt(scopeTally.churches) + " " + esc(t("roster.churches")) + "</div>" +
        '<div class="tally-split">' +
        esc(t("church.men")) + " " + fmt(scopeTally.men) + " · " +
        esc(t("church.women")) + " " + fmt(scopeTally.women) + " · " +
        esc(t("church.children")) + " " + fmt(scopeTally.children) +
        "</div>" +
        (!all
          ? '<div class="tally-compare">' + esc(t("roster.yourEstimate")) + ": <strong>" +
            (reported ? fmt(reported) : "—") + "</strong></div>" +
            '<button class="btn btn-quiet" data-use-tally="' + scopeTally.total + '">' +
            esc(t("roster.use")) + "</button>"
          : "") +
        "</div>";
    }

    if (!rows.length) {
      head += '<div class="field-note">' + esc(t("roster.none")) + "</div>";
    } else {
      head +=
        '<div class="roster">' +
        rows
          .map(function (r) {
            var prov = provinceById(r.provinceId);
            var where = prov ? provinceName(prov) : t("roster.noProvince");
            var figures = r.congregationTotal
              ? fmt(r.congregation.men) + " / " + fmt(r.congregation.women) + " / " +
                fmt(r.congregation.children)
              : esc(t("roster.noNumbers"));
            return (
              '<div class="roster-row">' +
              '<div class="roster-main">' +
              '<div class="roster-name">' + esc(r.name) +
              (r.role !== "pastor"
                ? ' <span class="role-badge role-' + esc(r.role) + '">' +
                  esc(t("role." + r.role)) + "</span>"
                : "") +
              "</div>" +
              '<div class="roster-sub">' +
              (r.churchName ? esc(r.churchName) + " · " : "") +
              (r.denomination ? esc(r.denomination) + " · " : "") +
              (all ? esc(where) + " · " : "") +
              '<a href="tel:+' + esc(r.phone) + '">' + esc(r.phoneDisplay) + "</a>" +
              "</div>" +
              (r.villages && r.villages.length
                ? '<div class="roster-sub">' + fmt(r.villages.length) + " " +
                  esc(t(r.villages.length === 1 ? "roster.villageServed" : "roster.villagesServed")) +
                  "</div>"
                : "") +
              (all && r.role === "pastor" && r.provinceId
                ? '<button class="btn-link" data-make-leader="' + esc(r.phone) + '">' +
                  esc(t("roster.makeLeader")) + "</button>"
                : "") +
              "</div>" +
              '<div class="roster-figures">' +
              '<div class="roster-total num">' +
              (r.congregationTotal ? fmt(r.congregationTotal) : "—") + "</div>" +
              '<div class="roster-split">' + figures + "</div>" +
              "</div>" +
              "</div>"
            );
          })
          .join("") +
        "</div>";
    }

    head += "</div>";
    app.appendChild(el(head));
  }

  function renderChurch() {
    if (!state.ch.token) return renderAuth();

    if (state.ch.loading || !state.ch.me) {
      app.appendChild(el('<div class="loading">…</div>'));
      return;
    }

    renderProfileCard();
    renderContactsCard();
    if (isLeader()) renderRosterCard();
  }

  // ---------- render ----------

  function render() {
    app.innerHTML = "";

    document.getElementById("tab-dashboard").textContent = t("nav.dashboard");
    document.getElementById("tab-submit").textContent = t("nav.submit");
    document.getElementById("tab-registry").textContent = t("nav.registry");
    document.getElementById("tab-church").textContent = t("nav.church");
    document.getElementById("tab-goal").textContent = t("nav.goal");
    document.getElementById("brand-title").textContent = t("app.title");
    document.getElementById("brand-sub").textContent = t("app.subtitle");
    document.getElementById("footer-text").textContent = t("footer");

    var lang = window.I18N.getLang();
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang-opt]"), function (n) {
      n.classList.toggle("on", n.getAttribute("data-lang-opt") === lang);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (n) {
      n.classList.toggle("active", n.getAttribute("data-view") === state.view);
    });

    if (state.view === "submit") return renderSubmit();
    if (state.view === "registry") return renderRegistry();
    if (state.view === "church") return renderChurch();

    if (state.loading) {
      app.appendChild(el('<div class="loading">…</div>'));
      return;
    }
    if (state.error) app.appendChild(el('<div class="error">' + esc(state.error) + "</div>"));

    if (state.view === "goal") renderGoal();
    else renderDashboard();
  }

  function go(view) {
    state.view = view;
    if (view === "submit") state.sent = false;
    state.formError = "";
    if (view === "church") {
      state.ch.error = "";
      state.ch.notice = "";
    }
    render();
    // Always re-read on the way in: another province may have reported since
    // this page was opened.
    if (view === "dashboard" || view === "goal" || view === "registry") load(true);
    if (view === "church" && state.ch.token) {
      loadMe(Boolean(state.ch.me));
      // The roster compares congregations against the province total, so that
      // total has to be current too.
      load(true);
    }
    if (view === "church" && state.ch.form.provinceId) loadChurchTree(state.ch.form.provinceId);
    window.scrollTo(0, 0);
  }

  // ---------- events ----------

  document.getElementById("tabs").addEventListener("click", function (e) {
    var tab = e.target.closest("[data-view]");
    if (tab) go(tab.getAttribute("data-view"));
  });

  document.getElementById("lang-toggle").addEventListener("click", function () {
    window.I18N.setLang(window.I18N.getLang() === "en" ? "km" : "en");
    render();
  });

  document.getElementById("brand-home").addEventListener("click", function (e) {
    e.preventDefault();
    go("dashboard");
  });

  app.addEventListener("change", function (e) {
    if (e.target.id === "f-province") return onProvinceChange();
    if (e.target.id === "a-province") {
      state.ch.auth.provinceId = e.target.value;
      return;
    }
    if (e.target.id === "ch-province") {
      state.ch.form.provinceId = e.target.value;
      // Villages belong to a province; keeping the old province's picks after a
      // move would quietly attribute a church to the wrong place.
      state.ch.villages = [];
      state.ch.vilFilter = "";
      state.ch.tree = null;
      state.ch.treeFor = "";
      render();
      loadChurchTree(state.ch.form.provinceId);
      return;
    }
  });

  app.addEventListener("input", function (e) {
    if (e.target.id === "reg-search") {
      state.regFilter = e.target.value;
      refreshRegList();
      return;
    }
    if (e.target.id === "reg-pass") {
      regPass = e.target.value;
      return;
    }
    if (e.target.id === "ch-vil-search") {
      state.ch.vilFilter = e.target.value;
      refreshChVil();
      return;
    }
    if (CH_NUM_FIELD[e.target.id]) {
      state.ch.form[CH_NUM_FIELD[e.target.id]] = e.target.value;
      refreshChTotal();
      return;
    }
    if (CH_FIELD[e.target.id]) {
      state.ch.form[CH_FIELD[e.target.id]] = e.target.value;
      return;
    }
    if (AUTH_FIELD[e.target.id]) {
      state.ch.auth[AUTH_FIELD[e.target.id]] = e.target.value;
      return;
    }
    if (e.target.id === "ch-pin-cur") {
      state.ch.pin.current = e.target.value;
      return;
    }
    if (e.target.id === "ch-pin-new") {
      state.ch.pin.next = e.target.value;
      return;
    }
    syncField(e);
  });

  app.addEventListener("click", function (e) {
    var conf = e.target.closest("[data-conf]");
    if (conf) {
      state.confidence = Number(conf.getAttribute("data-conf"));
      // Update in place so the form's typed values survive.
      Array.prototype.forEach.call(document.querySelectorAll("[data-conf]"), function (b) {
        b.classList.toggle("on", Number(b.getAttribute("data-conf")) === state.confidence);
      });
      document.getElementById("conf-caption").textContent = confBand(state.confidence);
      return;
    }
    var regOpen = e.target.closest("[data-reg-open]");
    if (regOpen) return openRegistryProvince(regOpen.getAttribute("data-reg-open"));

    if (e.target.closest("[data-reg-back]")) {
      state.regProvince = null;
      state.regData = null;
      state.regError = "";
      render();
      return;
    }

    var exp = e.target.closest("[data-exp]");
    if (exp) {
      var code = exp.getAttribute("data-exp");
      state.regOpen[code] = !state.regOpen[code];
      refreshRegList();
      return;
    }

    var vil = e.target.closest("[data-vil]");
    if (vil) return toggleVillage(vil.getAttribute("data-vil"));

    var vilAdd = e.target.closest("[data-vil-add]");
    if (vilAdd) {
      state.ch.villages.push({
        code: vilAdd.getAttribute("data-vil-add"),
        name: vilAdd.getAttribute("data-vil-name"),
        nameKhmer: vilAdd.getAttribute("data-vil-km"),
        communeName: vilAdd.getAttribute("data-vil-commune"),
      });
      state.ch.vilFilter = "";
      var searchBox = document.getElementById("ch-vil-search");
      if (searchBox) searchBox.value = "";
      refreshChVil();
      return;
    }

    var vilDel = e.target.closest("[data-vil-del]");
    if (vilDel) {
      var gone = vilDel.getAttribute("data-vil-del");
      state.ch.villages = state.ch.villages.filter(function (v) {
        return v.code !== gone;
      });
      refreshChVil();
      return;
    }

    if (e.target.closest("#a-go")) return authSubmit();
    if (e.target.closest("#a-mode")) {
      state.ch.mode = state.ch.mode === "signup" ? "signin" : "signup";
      state.ch.error = "";
      render();
      return;
    }
    if (e.target.closest("#ch-save")) return saveProfile();
    if (e.target.closest("#ch-signout")) return signOut();
    if (e.target.closest("#ch-pin-toggle")) {
      state.ch.pinOpen = !state.ch.pinOpen;
      state.ch.error = "";
      render();
      return;
    }
    if (e.target.closest("#ch-pin-save")) return changePin();

    var makeLeader = e.target.closest("[data-make-leader]");
    if (makeLeader) return setRole(makeLeader.getAttribute("data-make-leader"), "leader");

    // Carry the roster's figure straight into the report rather than asking a
    // leader to copy a six-digit number across two screens.
    var useTally = e.target.closest("[data-use-tally]");
    if (useTally) {
      state.form.provinceId = state.ch.me.provinceId;
      state.form.christians = useTally.getAttribute("data-use-tally");
      state.form.name = state.ch.me.name;
      go("submit");
      return;
    }

    if (e.target.closest("#f-submit")) return submit();
    if (e.target.closest("[data-again]")) return go("submit");
    var goBtn = e.target.closest("[data-go]");
    if (goBtn) return go(goBtn.getAttribute("data-go"));
  });

  // ---------- boot ----------

  window.I18N.setLang(window.I18N.getLang());
  try {
    state.ch.token = localStorage.getItem(TOKEN_KEY) || "";
  } catch (e) {}
  if (state.ch.token) loadMe(true);
  load();
})();
