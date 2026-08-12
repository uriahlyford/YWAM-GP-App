// Vision 2033 — one number per province.
//
// Each province's church leader submits their best estimate of how many Christians
// are in their province, plus how sure they are of it (1–10). That's the whole app.
(function () {
  "use strict";

  var t = window.I18N.t;
  var provinceName = window.I18N.provinceName;
  var PROVINCES = window.PROVINCES || [];
  var PASSCODE_KEY = "vision2033.passcode";

  var state = {
    view: "dashboard",
    loading: true,
    error: "",
    byProvince: {}, // provinceId -> latest entry
    // submit form
    confidence: 0,
    sending: false,
    formError: "",
    sent: false,
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

  function confBand(c) {
    if (c >= 8) return t("conf.high");
    if (c >= 4) return t("conf.mid");
    return t("conf.low");
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

  // ---------- data ----------

  // silent = refresh in place, without flashing the loading state over data
  // that's already on screen.
  function load(silent) {
    if (!silent) {
      state.loading = true;
      render();
    }
    fetch("/api/entries")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var map = {};
        (data.provinces || []).forEach(function (p) {
          var latest = (p.history || [])[0];
          if (latest) map[p.id] = latest;
        });
        state.byProvince = map;
        state.loading = false;
        state.error = "";
        render();
      })
      .catch(function () {
        state.loading = false;
        state.error = t("err.generic");
        render();
      });
  }

  // ---------- dashboard ----------

  function renderDashboard() {
    var reported = [];
    var totalChristians = 0;
    var totalPop = 0;

    PROVINCES.forEach(function (p) {
      var entry = state.byProvince[p.id];
      if (!entry) return;
      var c = christiansOf(entry);
      reported.push({ province: p, entry: entry, christians: c });
      totalChristians += c;
      totalPop += p.referencePopulation || 0;
    });

    if (!reported.length) {
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

    reported.sort(function (a, b) {
      return b.christians - a.christians;
    });

    app.appendChild(
      el(
        '<div class="card headline">' +
          '<div class="headline-num num">' + fmt(totalChristians) + "</div>" +
          '<div class="headline-label">' + esc(t("dash.total")) + "</div>" +
          '<div class="headline-sub">' +
          esc(t("dash.from")) + " " + reported.length + " " + esc(t("dash.ofProvinces")) +
          " · " + pct(totalChristians, totalPop) + " " + esc(t("dash.percent")) +
          "</div>" +
          "</div>"
      )
    );

    var rows =
      '<div class="row row-head">' +
      "<div>" + esc(t("table.province")) + "</div>" +
      '<div style="text-align:right">' + esc(t("table.christians")) + "</div>" +
      '<div style="text-align:right">' + esc(t("table.confidence")) + "</div>" +
      "</div>";

    reported.forEach(function (r) {
      var conf = Number(r.entry.confidence) || 0;
      var pips = "";
      for (var i = 1; i <= 10; i++) pips += '<span class="conf-pip' + (i <= conf ? " on" : "") + '"></span>';

      rows +=
        '<div class="row">' +
        '<div class="row-name">' + esc(provinceName(r.province)) +
        (r.entry.enteredBy
          ? '<div class="row-by">' + esc(t("dash.by")) + " " + esc(r.entry.enteredBy) + "</div>"
          : "") +
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
            esc(
              missing
                .map(function (p) {
                  return provinceName(p);
                })
                .join(" · ")
            ) +
            "</div>"
        )
      );
    }
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

    var options = '<option value="">' + esc(t("submit.choose")) + "</option>";
    PROVINCES.forEach(function (p) {
      options += '<option value="' + esc(p.id) + '">' + esc(provinceName(p)) + "</option>";
    });

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
      '<input class="big" id="f-christians" type="number" inputmode="numeric" min="0" step="1" placeholder="0" />' +
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
      '<input id="f-name" type="text" placeholder="' + esc(t("submit.name.placeholder")) + '" />' +
      "</div>" +
      '<div class="field">' +
      '<label class="label" for="f-pass">' + esc(t("submit.passcode")) + "</label>" +
      '<input id="f-pass" type="password" value="' + esc(savedPass) +
      '" placeholder="' + esc(t("submit.passcode.placeholder")) + '" />' +
      "</div>" +
      '<button class="btn" id="f-submit"' + (state.sending ? " disabled" : "") + ">" +
      esc(state.sending ? t("submit.sending") : t("submit.button")) +
      "</button>" +
      "</div>";

    app.appendChild(el(card));
  }

  function submit() {
    var provinceId = document.getElementById("f-province").value;
    var christiansRaw = document.getElementById("f-christians").value;
    var enteredBy = document.getElementById("f-name").value.trim();
    var passcode = document.getElementById("f-pass").value;

    if (!provinceId) return fail(t("err.province"));
    if (christiansRaw === "" || !isFinite(Number(christiansRaw)) || Number(christiansRaw) < 0)
      return fail(t("err.number"));
    if (!state.confidence) return fail(t("err.confidence"));
    if (!passcode) return fail(t("err.passcode"));

    var p = provinceById(provinceId);

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

    if (state.view === "dashboard") {
      if (state.loading) {
        app.appendChild(el('<div class="loading">…</div>'));
        return;
      }
      if (state.error) app.appendChild(el('<div class="error">' + esc(state.error) + "</div>"));
      renderDashboard();
    } else {
      renderSubmit();
    }
  }

  function go(view) {
    state.view = view;
    if (view === "submit") state.sent = false;
    state.formError = "";
    render();
    // Always re-read on the way in: another province may have reported since
    // this page was opened.
    if (view === "dashboard") load(true);
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
    if (e.target.closest("#f-submit")) return submit();
    if (e.target.closest("[data-again]")) return go("submit");
    var goBtn = e.target.closest("[data-go]");
    if (goBtn) return go(goBtn.getAttribute("data-go"));
  });

  // ---------- boot ----------

  window.I18N.setLang(window.I18N.getLang());
  load();
})();
