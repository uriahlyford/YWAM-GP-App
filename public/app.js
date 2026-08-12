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
  var PASSCODE_KEY = "vision2033.passcode";

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

  // silent = refresh in place, without flashing the loading state over data
  // that's already on screen.
  function load(silent) {
    if (!silent) {
      state.loading = true;
      render();
    }
    Promise.all([
      fetch("/api/entries")
        .then(function (r) {
          return r.json();
        })
        .catch(function () {
          return null;
        }),
      // Registry totals ride along, so the dashboard can show confirmed
      // alongside estimated without a second round trip.
      fetch("/api/villages?summary=1")
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

  // ---------- dashboard ----------

  function renderDashboard() {
    var s = totals();

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
      fetch("/data/villages/" + encodeURIComponent(id) + ".json")
        .then(function (r) {
          return r.json();
        })
        .catch(function () {
          return null;
        }),
      fetch("/api/villages?province=" + encodeURIComponent(id))
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

    fetch("/api/villages", {
      method: "POST",
      headers: { "content-type": "application/json" },
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
      '<div class="field">' +
      '<label class="label" for="f-name">' + esc(t("submit.name")) + "</label>" +
      '<input id="f-name" type="text" value="' + esc(f.name) +
      '" placeholder="' + esc(t("submit.name.placeholder")) + '" />' +
      "</div>" +
      '<div class="field">' +
      '<label class="label" for="f-pass">' + esc(t("submit.passcode")) + "</label>" +
      '<input id="f-pass" type="password" value="' + esc(f.passcode || savedPass) +
      '" placeholder="' + esc(t("submit.passcode.placeholder")) + '" />' +
      "</div>" +
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

  function syncField(e) {
    var key = FIELD_OF[e.target.id];
    if (key) state.form[key] = e.target.value;
  }

  function submit() {
    var provinceId = document.getElementById("f-province").value;
    var christiansRaw = document.getElementById("f-christians").value;
    var villagesRaw = document.getElementById("f-villages").value;
    var enteredBy = document.getElementById("f-name").value.trim();
    var passcode = document.getElementById("f-pass").value;

    if (!provinceId) return fail(t("err.province"));
    if (christiansRaw === "" || !isFinite(Number(christiansRaw)) || Number(christiansRaw) < 0)
      return fail(t("err.number"));
    if (villagesRaw === "" || !isFinite(Number(villagesRaw)) || Number(villagesRaw) < 0)
      return fail(t("err.villages"));

    var p = provinceById(provinceId);
    if (p && p.referenceVillages && Number(villagesRaw) > p.referenceVillages)
      return fail(t("err.villagesMax"));
    if (!state.confidence) return fail(t("err.confidence"));
    if (!passcode) return fail(t("err.passcode"));

    state.sending = true;
    state.formError = "";
    render();

    fetch("/api/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
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
        try {
          localStorage.setItem(PASSCODE_KEY, passcode);
        } catch (e) {}
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

  // ---------- render ----------

  function render() {
    app.innerHTML = "";

    document.getElementById("tab-dashboard").textContent = t("nav.dashboard");
    document.getElementById("tab-submit").textContent = t("nav.submit");
    document.getElementById("tab-registry").textContent = t("nav.registry");
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
    render();
    // Always re-read on the way in: another province may have reported since
    // this page was opened.
    if (view === "dashboard" || view === "goal" || view === "registry") load(true);
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
    if (e.target.id === "f-province") onProvinceChange();
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

    if (e.target.closest("#f-submit")) return submit();
    if (e.target.closest("[data-again]")) return go("submit");
    var goBtn = e.target.closest("[data-go]");
    if (goBtn) return go(goBtn.getAttribute("data-go"));
  });

  // ---------- boot ----------

  window.I18N.setLang(window.I18N.getLang());
  load();
})();
