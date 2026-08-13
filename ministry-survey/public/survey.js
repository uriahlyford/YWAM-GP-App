// YWAM Cambodia ministry survey.
//
// The shape of the form follows the shape of the organisation. A handful of
// regional leaders each report for several provinces, and a province holds one
// or more ministries, each with its own leader — a base leader whose campus and
// three outside ministries all sit in one province fills four cards under that
// province, each naming the person who runs it. So the form goes
//
//   you  ->  the provinces you report for  ->  a card per ministry inside each
//
// rather than one flat questionnaire.
//
// Two reporting windows, kept apart on purpose. Training schools are asked for
// the closed calendar year, because "how many students go through our schools in
// a year" only has a clean answer once the year is over. Everything else — staff,
// sports, English classes, churches — is asked as it stands today, because that's
// the number a leader can give from memory without digging through records.
//
// Every keystroke is written to a draft in localStorage. These are long reports
// written on phones over the course of a day, often on a connection that drops;
// losing a half-finished one would cost more than the report is worth.

(function () {
  "use strict";

  var DRAFT_KEY = "ywam-survey-draft-v1";
  var PASS_KEY = "ywam-survey-passcode";
  var YEAR = window.REPORT_YEAR;

  var PROVINCES = window.PROVINCES || [];
  var MINISTRY_TYPES = window.MINISTRY_TYPES || [];
  var SCHOOL_TYPES = window.SCHOOL_TYPES || [];

  var provinceById = {};
  var provinceOrder = {};
  PROVINCES.forEach(function (p, i) {
    provinceById[p.id] = p;
    provinceOrder[p.id] = i;
  });

  var typeById = {};
  MINISTRY_TYPES.forEach(function (t) { typeById[t.id] = t; });

  var schoolById = {};
  SCHOOL_TYPES.forEach(function (s) { schoolById[s.id] = s; });

  // ---------- state ----------

  var state = {
    tab: "form",
    step: "you", // you | ministries | review | done
    report: blankReport(),
    openMinistry: null,
    passcode: localStorage.getItem(PASS_KEY) || "",
    error: "",
    busy: false,
    results: null,
    resultsError: "",
    loadingResults: false,
  };

  function blankReport() {
    return {
      leaderName: "",
      leaderRole: "",
      leaderContact: "",
      provinceIds: [],
      ministries: [],
      notes: "",
    };
  }

  function blankMinistry(provinceId) {
    return {
      id: uid(),
      provinceId: provinceId,
      name: "",
      leaderName: "",
      placement: "",
      town: "",
      startedYear: "",
      types: [],
      typeOther: "",
      // as of today
      staffTotal: "",
      staffCambodian: "",
      staffInternational: "",
      staffFullTime: "",
      staffVolunteer: "",
      youthDaily: "",
      peopleWeekly: "",
      currentStudents: "",
      villagesReached: "",
      villageNames: "",
      churchesServed: "",
      churchesLed: "",
      // for the reporting year
      schools: [],
      teamsHosted: "",
      outreachTeams: "",
      churchesPlanted: "",
      newBelievers: "",
      baptisms: "",
      // words
      biggestNeed: "",
      prayerRequest: "",
    };
  }

  function blankSchool() {
    return { id: uid(), typeId: "", name: "", students: "", cambodianStudents: "", graduates: "" };
  }

  var seq = 0;
  function uid() {
    seq += 1;
    return "m" + Date.now().toString(36) + seq.toString(36);
  }

  // ---------- draft ----------

  var flagTimer = null;
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state.report));
    } catch (e) {
      /* a full or disabled localStorage shouldn't break typing */
    }
    var flag = document.getElementById("saved-flag");
    if (!flag) return;
    flag.hidden = false;
    clearTimeout(flagTimer);
    flagTimer = setTimeout(function () { flag.hidden = true; }, 1600);
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return;

      var base = blankReport();
      Object.keys(base).forEach(function (k) {
        if (saved[k] !== undefined && saved[k] !== null) base[k] = saved[k];
      });
      // Bring an older draft up to the current ministry shape rather than dropping it.
      base.ministries = (base.ministries || []).map(function (m) {
        var fresh = blankMinistry(m.provinceId || "");
        Object.keys(fresh).forEach(function (k) {
          if (m[k] !== undefined && m[k] !== null) fresh[k] = m[k];
        });
        fresh.id = m.id || uid();
        fresh.schools = (m.schools || []).map(function (s) {
          var fs = blankSchool();
          Object.keys(fs).forEach(function (k) {
            if (s[k] !== undefined && s[k] !== null) fs[k] = s[k];
          });
          fs.id = s.id || uid();
          return fs;
        });
        return fresh;
      });
      state.report = base;
    } catch (e) {
      /* a corrupt draft is not worth a crash */
    }
  }

  // ---------- helpers ----------

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function n(v) {
    var x = parseFloat(v);
    return Number.isFinite(x) && x >= 0 ? x : 0;
  }

  function fmt(x) {
    return Number(x || 0).toLocaleString("en-US");
  }

  function plural(count, one, many) {
    return count === 1 ? one : many;
  }

  function provinceName(id) {
    var p = provinceById[id];
    return p ? p.name : id;
  }

  function ministriesIn(provinceId) {
    return state.report.ministries.filter(function (m) { return m.provinceId === provinceId; });
  }

  function findMinistry(id) {
    for (var i = 0; i < state.report.ministries.length; i++) {
      if (state.report.ministries[i].id === id) return state.report.ministries[i];
    }
    return null;
  }

  function typeLabels(m) {
    return (m.types || []).map(function (t) {
      return t === "other" && m.typeOther ? m.typeOther : (typeById[t] ? typeById[t].label : t);
    });
  }

  function ministryLabel(m) {
    return m.name ? esc(m.name) : '<span class="unnamed">Untitled ministry</span>';
  }

  function ministrySub(m) {
    var bits = [];
    if (m.leaderName) bits.push("Led by " + m.leaderName);
    var labels = typeLabels(m);
    if (labels.length) {
      bits.push(labels.slice(0, 2).join(", ") + (labels.length > 2 ? " +" + (labels.length - 2) : ""));
    }
    if (m.staffTotal !== "") bits.push(n(m.staffTotal) + " staff");
    return bits.length ? esc(bits.join(" · ")) : "Tap to fill in";
  }

  // A ministry is only worth submitting once it has a name, a leader and a staff
  // count — those are what make it countable now and chaseable later.
  function missingFrom(m) {
    var missing = [];
    if (!m.name.trim()) missing.push("a name");
    if (!m.leaderName.trim()) missing.push("who leads it");
    if (m.staffTotal === "") missing.push("a staff count");
    return missing;
  }

  function schoolStudents(m) {
    return (m.schools || []).reduce(function (a, s) { return a + n(s.students); }, 0);
  }

  // ---------- render ----------

  var app = document.getElementById("app");

  function render() {
    document.getElementById("tab-form").classList.toggle("active", state.tab === "form");
    document.getElementById("tab-results").classList.toggle("active", state.tab === "results");

    if (state.tab === "results") {
      app.innerHTML = renderResults();
    } else if (state.step === "you") {
      app.innerHTML = renderYou();
    } else if (state.step === "ministries") {
      app.innerHTML = renderMinistries();
    } else if (state.step === "review") {
      app.innerHTML = renderReview();
    } else {
      app.innerHTML = renderDone();
    }
    window.scrollTo(0, 0);
  }

  function errorBox() {
    return state.error ? '<div class="error">' + esc(state.error) + "</div>" : "";
  }

  // --- step 1: you and your provinces ---

  function renderYou() {
    var r = state.report;
    var picks = PROVINCES.map(function (p) {
      var on = r.provinceIds.indexOf(p.id) !== -1;
      var count = ministriesIn(p.id).length;
      return (
        '<button type="button" class="pick' + (on ? " on" : "") + '" data-province="' + p.id + '">' +
          '<span class="pick-box" aria-hidden="true">✓</span>' +
          '<span class="pick-name">' + esc(p.name) +
            (count ? ' <span class="pick-count">(' + count + ")</span>" : "") +
          "</span>" +
        "</button>"
      );
    }).join("");

    return (
      '<div class="step-head">' +
        '<div class="step-kicker">Step 1 of 3</div>' +
        '<h1 class="step-title">Who is reporting</h1>' +
        '<p class="step-sub">You fill this in once. Everything after it is about the ministries you oversee.</p>' +
      "</div>" +
      errorBox() +
      '<div class="card">' +
        '<div class="field">' +
          '<label class="label" for="f-leaderName">Your name</label>' +
          '<input type="text" id="f-leaderName" data-bind="leaderName" value="' + esc(r.leaderName) + '" autocomplete="name" />' +
        "</div>" +
        '<div class="field">' +
          '<label class="label" for="f-leaderRole">Your role <span class="label-hint">e.g. Phnom Penh base leader</span></label>' +
          '<input type="text" id="f-leaderRole" data-bind="leaderRole" value="' + esc(r.leaderRole) + '" />' +
        "</div>" +
        '<div class="field" style="margin-bottom:0">' +
          '<label class="label" for="f-leaderContact">Phone or email <span class="label-hint">so we can come back with questions</span></label>' +
          '<input type="text" id="f-leaderContact" data-bind="leaderContact" value="' + esc(r.leaderContact) + '" />' +
        "</div>" +
      "</div>" +
      '<div class="card">' +
        '<label class="label">Which provinces do you report for?</label>' +
        '<p class="field-note">Pick every province you have ministry in, including ones you oversee from somewhere else. You list the ministries inside each one on the next step.</p>' +
        '<div class="pick-grid">' + picks + "</div>" +
      "</div>" +
      '<button class="btn" data-action="to-ministries">Continue</button>'
    );
  }

  // --- step 2: ministries, grouped by province ---

  function renderMinistries() {
    var r = state.report;
    var blocks = r.provinceIds.map(function (pid) {
      var list = ministriesIn(pid);
      return (
        '<section class="prov-block">' +
          '<div class="prov-block-head">' +
            '<div class="prov-block-name">' + esc(provinceName(pid)) + "</div>" +
            '<div class="prov-block-count">' + list.length + " " + plural(list.length, "ministry", "ministries") + "</div>" +
          "</div>" +
          (list.length
            ? list.map(renderMinistryCard).join("")
            : '<div class="prov-block-empty">No ministries listed here yet.</div>') +
          '<button type="button" class="btn-add" data-add-ministry="' + pid + '">+ Add a ministry in ' + esc(provinceName(pid)) + "</button>" +
        "</section>"
      );
    }).join("");

    var total = r.ministries.length;

    return (
      '<div class="step-head">' +
        '<div class="step-kicker">Step 2 of 3</div>' +
        '<h1 class="step-title">Your ministries</h1>' +
        '<p class="step-sub">One card per ministry, under the province it sits in. If a province has three ministries with three different leaders, add three cards. Only the name, the leader and the staff count are required — fill in the rest where you know it, and leave anything you don\'t.</p>' +
      "</div>" +
      errorBox() +
      blocks +
      '<div class="btn-row">' +
        '<button class="btn-ghost" data-action="to-you">Back</button>' +
        '<button class="btn" data-action="to-review">Review ' + total + " " + plural(total, "ministry", "ministries") + "</button>" +
      "</div>"
    );
  }

  function renderMinistryCard(m) {
    var open = state.openMinistry === m.id;
    return (
      '<article class="min-card' + (open ? " open" : "") + '">' +
        '<button type="button" class="min-summary" data-toggle-ministry="' + m.id + '">' +
          '<span class="min-summary-text">' +
            '<span class="min-summary-name">' + ministryLabel(m) + "</span>" +
            '<span class="min-summary-sub">' + ministrySub(m) + "</span>" +
          "</span>" +
          '<span class="min-caret">' + (open ? "▲" : "▼") + "</span>" +
        "</button>" +
        (open ? '<div class="min-body">' + renderMinistryBody(m) + "</div>" : "") +
      "</article>"
    );
  }

  function fieldWrap(label, hint, control) {
    return (
      '<div class="field-sm">' +
        '<label class="label-sm">' + esc(label) +
          (hint ? ' <span class="opt">' + esc(hint) + "</span>" : "") +
        "</label>" +
        control +
      "</div>"
    );
  }

  function numField(m, key, label, hint) {
    return fieldWrap(label, hint,
      '<input type="number" min="0" inputmode="numeric" data-min="' + m.id + '" data-key="' + key + '" value="' + esc(m[key]) + '" />');
  }

  function textField(m, key, label, hint) {
    return fieldWrap(label, hint,
      '<input type="text" data-min="' + m.id + '" data-key="' + key + '" value="' + esc(m[key]) + '" />');
  }

  function areaField(m, key, label, hint) {
    return fieldWrap(label, hint,
      '<textarea data-min="' + m.id + '" data-key="' + key + '">' + esc(m[key]) + "</textarea>");
  }

  function renderMinistryBody(m) {
    var chips = MINISTRY_TYPES.map(function (t) {
      var on = m.types.indexOf(t.id) !== -1;
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-min="' + m.id + '" data-type="' + t.id + '">' + esc(t.label) + "</button>";
    }).join("");

    var provinceOptions = state.report.provinceIds.map(function (pid) {
      return '<option value="' + pid + '"' + (pid === m.provinceId ? " selected" : "") + ">" + esc(provinceName(pid)) + "</option>";
    }).join("");

    return (
      '<div class="sect">' +
        '<div class="sect-title">The ministry</div>' +
        textField(m, "name", "Ministry name", "what you call it") +
        textField(m, "leaderName", "Who leads it", "the person responsible on the ground") +
        fieldWrap("Province", "", '<select data-min="' + m.id + '" data-key="provinceId">' + provinceOptions + "</select>") +
        '<div class="pair">' +
          fieldWrap("Where", "optional",
            '<select data-min="' + m.id + '" data-key="placement">' +
              '<option value=""' + (m.placement === "" ? " selected" : "") + ">—</option>" +
              '<option value="campus"' + (m.placement === "campus" ? " selected" : "") + ">On the main base</option>" +
              '<option value="offsite"' + (m.placement === "offsite" ? " selected" : "") + ">A separate location</option>" +
            "</select>") +
          textField(m, "town", "Town or district", "optional") +
        "</div>" +
        '<div style="margin-top:14px">' + numField(m, "startedYear", "Year it started", "optional") + "</div>" +
      "</div>" +

      '<div class="sect">' +
        '<div class="sect-title">What kind of ministry</div>' +
        '<p class="field-note">Tick everything that applies.</p>' +
        '<div class="chips">' + chips + "</div>" +
        (m.types.indexOf("other") !== -1
          ? '<div style="margin-top:14px">' + textField(m, "typeOther", "Describe the other ministry") + "</div>"
          : "") +
      "</div>" +

      '<div class="sect">' +
        '<div class="sect-title">Staff — right now</div>' +
        numField(m, "staffTotal", "Total staff in this ministry") +
        '<div class="pair">' +
          numField(m, "staffCambodian", "Cambodian", "optional") +
          numField(m, "staffInternational", "International", "optional") +
        "</div>" +
        '<div class="pair" style="margin-top:14px">' +
          numField(m, "staffFullTime", "Full-time", "optional") +
          numField(m, "staffVolunteer", "Part-time / volunteer", "optional") +
        "</div>" +
      "</div>" +

      '<div class="sect">' +
        '<div class="sect-title">Who you reach — right now</div>' +
        numField(m, "youthDaily", "Children & youth you reach on a normal day", "a typical weekday, not a one-off event") +
        numField(m, "currentStudents", "Students enrolled at the moment", "sports, English, tutoring — not the training schools below") +
        numField(m, "peopleWeekly", "People of all ages you reach in a normal week", "optional") +
        numField(m, "villagesReached", "Villages or communities you go into", "optional") +
        areaField(m, "villageNames", "Which villages", "optional — one per line, or separated by commas") +
      "</div>" +

      '<div class="sect">' +
        '<div class="sect-title">Local churches — right now</div>' +
        numField(m, "churchesServed", "Churches you serve", "you support them, someone else leads") +
        numField(m, "churchesLed", "Churches you lead", "one of your staff is the pastor or leader") +
      "</div>" +

      '<div class="sect">' +
        '<div class="sect-title">Training schools in ' + YEAR + "</div>" +
        '<p class="field-note">A row for each school or course that ran during ' + YEAR + ". Skip this if none did.</p>" +
        m.schools.map(function (s, i) { return renderSchool(m, s, i); }).join("") +
        '<button type="button" class="btn-add" data-add-school="' + m.id + '">+ Add a school or course</button>' +
      "</div>" +

      '<div class="sect">' +
        '<div class="sect-title">Teams &amp; outreach in ' + YEAR + "</div>" +
        numField(m, "teamsHosted", "Teams you hosted", "visiting teams that came to you during " + YEAR) +
        numField(m, "outreachTeams", "Outreach teams you sent out", "optional") +
      "</div>" +

      '<div class="sect">' +
        '<div class="sect-title">Fruit in ' + YEAR + "</div>" +
        '<div class="pair">' +
          numField(m, "newBelievers", "New believers", "optional") +
          numField(m, "baptisms", "Baptisms", "optional") +
        "</div>" +
        '<div style="margin-top:14px">' +
          numField(m, "churchesPlanted", "Churches planted", "optional") +
        "</div>" +
      "</div>" +

      '<div class="sect">' +
        '<div class="sect-title">In your words</div>' +
        areaField(m, "biggestNeed", "Biggest need right now", "optional") +
        areaField(m, "prayerRequest", "One prayer request", "optional") +
      "</div>" +

      '<div class="sect min-actions">' +
        '<button type="button" class="btn-link" data-remove-ministry="' + m.id + '">Remove this ministry</button>' +
        '<button type="button" class="icon-btn" data-toggle-ministry="' + m.id + '">Done</button>' +
      "</div>"
    );
  }

  function renderSchool(m, s, i) {
    var opts = ['<option value="">Which school?</option>']
      .concat(SCHOOL_TYPES.map(function (t) {
        return '<option value="' + t.id + '"' + (t.id === s.typeId ? " selected" : "") + ">" + esc(t.label) + "</option>";
      }))
      .join("");

    function schoolNum(key, label, hint) {
      return fieldWrap(label, hint,
        '<input type="number" min="0" inputmode="numeric" data-min="' + m.id + '" data-school="' + s.id + '" data-key="' + key + '" value="' + esc(s[key]) + '" />');
    }

    return (
      '<div class="school">' +
        '<div class="school-head">' +
          '<select data-min="' + m.id + '" data-school="' + s.id + '" data-key="typeId">' + opts + "</select>" +
          '<button type="button" class="icon-btn" data-remove-school="' + s.id + '" data-min="' + m.id + '" aria-label="Remove school ' + (i + 1) + '">Remove</button>' +
        "</div>" +
        fieldWrap("School name", "optional",
          '<input type="text" data-min="' + m.id + '" data-school="' + s.id + '" data-key="name" value="' + esc(s.name) + '" />') +
        '<div class="pair">' +
          schoolNum("students", "Students") +
          schoolNum("cambodianStudents", "Cambodian", "optional") +
        "</div>" +
        '<div style="margin-top:14px">' + schoolNum("graduates", "Graduated", "optional") + "</div>" +
      "</div>"
    );
  }

  // --- step 3: review and send ---

  function renderReview() {
    var r = state.report;

    var blocks = r.provinceIds.map(function (pid) {
      return ministriesIn(pid).map(function (m) {
        var missing = missingFrom(m);
        var facts = [];
        if (m.staffTotal !== "") facts.push(n(m.staffTotal) + " staff");
        if (m.youthDaily !== "") facts.push(fmt(n(m.youthDaily)) + " young people a day");
        var students = schoolStudents(m);
        if (students) facts.push(students + " school students in " + YEAR);
        if (m.teamsHosted !== "") facts.push(n(m.teamsHosted) + " teams hosted");
        if (m.churchesServed !== "" || m.churchesLed !== "") {
          facts.push(n(m.churchesServed) + " churches served, " + n(m.churchesLed) + " led");
        }
        return (
          '<div class="rev-block">' +
            '<div class="rev-prov">' + esc(provinceName(pid)) + "</div>" +
            '<div class="rev-name">' + ministryLabel(m) +
              (m.leaderName ? ' <span class="rev-by">— ' + esc(m.leaderName) + "</span>" : "") +
            "</div>" +
            (facts.length ? '<div class="rev-facts">' + esc(facts.join(" · ")) + "</div>" : "") +
            (missing.length ? '<div class="rev-missing">Still needs ' + esc(missing.join(", ")) + "</div>" : "") +
          "</div>"
        );
      }).join("");
    }).join("");

    var t = totalsFor([reportForSubmit()]);

    return (
      '<div class="step-head">' +
        '<div class="step-kicker">Step 3 of 3</div>' +
        '<h1 class="step-title">Check and send</h1>' +
        '<p class="step-sub">This is what gets added to the national totals. You can send it and still change it later — a second report from you replaces the first.</p>' +
      "</div>" +
      errorBox() +
      '<div class="tiles">' +
        tile(t.provinces, "provinces") +
        tile(t.ministries, "ministries") +
        tile(t.staff, "staff") +
      "</div>" +
      '<div class="card">' + (blocks || '<p class="who">No ministries added yet.</p>') + "</div>" +
      '<div class="card">' +
        '<div class="field">' +
          '<label class="label" for="f-notes">Anything else we should know <span class="label-hint">optional</span></label>' +
          '<textarea id="f-notes" data-bind="notes">' + esc(r.notes) + "</textarea>" +
        "</div>" +
        '<div class="field" style="margin-bottom:0">' +
          '<label class="label" for="f-pass">Team passcode</label>' +
          '<input type="password" id="f-pass" data-pass value="' + esc(state.passcode) + '" autocomplete="off" />' +
        "</div>" +
      "</div>" +
      '<div class="btn-row">' +
        '<button class="btn-ghost" data-action="to-ministries">Back</button>' +
        '<button class="btn" data-action="submit"' + (state.busy ? " disabled" : "") + ">" +
          (state.busy ? "Sending…" : "Send my report") +
        "</button>" +
      "</div>"
    );
  }

  function renderDone() {
    return (
      '<div class="card success">' +
        '<div class="success-mark">✓</div>' +
        "<h2>Thank you</h2>" +
        "<p>Your report is in. If something changes, edit it and send again — your new report replaces the old one.</p>" +
      "</div>" +
      '<div class="btn-row">' +
        '<button class="btn-ghost" data-action="to-ministries">Edit my report</button>' +
        '<button class="btn" data-action="see-results">See the totals</button>' +
      "</div>"
    );
  }

  function tile(num, cap) {
    return '<div class="tile"><div class="tile-num num">' + fmt(num) + '</div><div class="tile-cap">' + esc(cap) + "</div></div>";
  }

  // ---------- totals ----------

  var CURRENT_SUMS = [
    "staffTotal", "staffCambodian", "staffInternational", "staffFullTime",
    "staffVolunteer", "youthDaily", "peopleWeekly", "currentStudents",
    "villagesReached", "churchesServed", "churchesLed",
  ];
  var YEAR_SUMS = ["teamsHosted", "outreachTeams", "churchesPlanted", "newBelievers", "baptisms"];

  function totalsFor(reports) {
    var t = { reports: reports.length, ministries: 0, provinces: 0, schools: 0,
      students: 0, cambodianStudents: 0, graduates: 0, byType: {}, byProvince: {} };
    CURRENT_SUMS.concat(YEAR_SUMS).forEach(function (k) { t[k] = 0; });

    var provinceSeen = {};

    reports.forEach(function (r) {
      (r.ministries || []).forEach(function (m) {
        t.ministries += 1;
        CURRENT_SUMS.forEach(function (k) { t[k] += n(m[k]); });
        YEAR_SUMS.forEach(function (k) { t[k] += n(m[k]); });

        var students = 0;
        (m.schools || []).forEach(function (s) {
          t.schools += 1;
          students += n(s.students);
          t.cambodianStudents += n(s.cambodianStudents);
          t.graduates += n(s.graduates);
        });
        t.students += students;

        (m.types || []).forEach(function (id) {
          if (!t.byType[id]) t.byType[id] = { ministries: 0, staff: 0, youthDaily: 0 };
          t.byType[id].ministries += 1;
          t.byType[id].staff += n(m.staffTotal);
          t.byType[id].youthDaily += n(m.youthDaily);
        });

        var pid = m.provinceId;
        if (!pid) return;
        provinceSeen[pid] = true;
        if (!t.byProvince[pid]) t.byProvince[pid] = { ministries: 0, staff: 0, youthDaily: 0, students: 0 };
        t.byProvince[pid].ministries += 1;
        t.byProvince[pid].staff += n(m.staffTotal);
        t.byProvince[pid].youthDaily += n(m.youthDaily);
        t.byProvince[pid].students += students;
      });
    });

    t.provinces = Object.keys(provinceSeen).length;
    t.staff = t.staffTotal;
    return t;
  }

  // ---------- the totals screen ----------

  function renderResults() {
    if (state.resultsError) {
      return (
        '<div class="card"><div class="error">' + esc(state.resultsError) + "</div>" +
          '<button class="btn" data-action="load-results">Try again</button></div>'
      );
    }
    if (state.loadingResults || !state.results) return '<div class="loading">Loading…</div>';

    var reports = state.results;
    var t = totalsFor(reports);

    if (!t.ministries) {
      return (
        '<div class="card empty">' +
          "<h2>Nothing reported yet</h2>" +
          "<p>The totals fill in as leaders send their reports.</p>" +
        "</div>" +
        '<button class="btn" data-action="to-ministries">Start my report</button>'
      );
    }

    // A ministry can be several kinds at once — a sports programme that is also
    // youth ministry is tagged both — so these rows overlap and must not be read
    // as a breakdown that sums to the total. The bars are scaled against the
    // largest row, not against the total, so nothing implies a share of a whole.
    var typeIds = Object.keys(t.byType).sort(function (a, b) {
      return t.byType[b].ministries - t.byType[a].ministries;
    });
    var widest = typeIds.length ? t.byType[typeIds[0]].ministries : 1;

    var typeRows = typeIds.map(function (id) {
      var row = t.byType[id];
      var pct = Math.round((row.ministries / widest) * 100);
      var detail = [row.ministries + " " + plural(row.ministries, "ministry", "ministries")];
      if (row.staff) detail.push(fmt(row.staff) + " staff");
      return (
        '<div class="bar-row">' +
          '<div class="bar-head"><span>' + esc(typeById[id] ? typeById[id].label : id) + "</span>" +
            "<b>" + esc(detail.join(" · ")) + "</b></div>" +
          '<div class="bar-track"><span style="width:' + pct + '%"></span></div>' +
        "</div>"
      );
    }).join("");

    var provinceRows = Object.keys(t.byProvince)
      .sort(function (a, b) { return provinceOrder[a] - provinceOrder[b]; })
      .map(function (pid) {
        var row = t.byProvince[pid];
        return (
          '<div class="row">' +
            '<div class="row-name">' + esc(provinceName(pid)) +
              '<div class="row-by">' + row.ministries + " " + plural(row.ministries, "ministry", "ministries") + "</div>" +
            "</div>" +
            '<div class="row-num num">' + fmt(row.staff) + '<div class="row-cap">staff</div></div>' +
            '<div class="row-num num">' + fmt(row.youthDaily) + '<div class="row-cap">a day</div></div>' +
          "</div>"
        );
      }).join("");

    var who = reports.map(function (r) {
      var count = (r.ministries || []).length;
      return "<b>" + esc(r.leaderName || "Unnamed") + "</b> — " + count + " " + plural(count, "ministry", "ministries");
    }).join("<br />");

    return (
      '<div class="step-head">' +
        '<h1 class="step-title">YWAM Cambodia today</h1>' +
        '<p class="step-sub">Built from ' + t.reports + " " + plural(t.reports, "report", "reports") +
          ". Staff, ministries and the people we reach are as they stand today; training schools, teams and fruit are for " + YEAR + ".</p>" +
      "</div>" +

      '<div class="tiles">' +
        tile(t.provinces, "provinces we are in") +
        tile(t.ministries, "ministries") +
        tile(t.staffTotal, "staff") +
        tile(t.youthDaily, "young people reached every day") +
        tile(t.students, "training school students in " + YEAR) +
        tile(t.churchesServed + t.churchesLed, "local churches served or led") +
      "</div>" +

      '<div class="card">' +
        '<div class="sec-head"><div class="sec-title">By province</div>' +
          '<div class="sec-count">' + t.provinces + " of " + PROVINCES.length + "</div></div>" +
        '<div class="rows">' + provinceRows + "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="sec-head"><div class="sec-title">How we reach them</div>' +
          '<div class="sec-count">' + t.ministries + " ministries</div></div>" +
        '<p class="field-note">A ministry can be more than one kind, so these rows overlap and add up to more than ' + t.ministries + ".</p>" +
        typeRows +
      "</div>" +

      statCard("Right now", [
        [t.staffCambodian, "Cambodian staff"],
        [t.staffInternational, "international staff"],
        [t.staffFullTime, "full-time staff"],
        [t.staffVolunteer, "part-time and volunteer staff"],
        [t.currentStudents, "students enrolled in our classes and programmes"],
        [t.peopleWeekly, "people reached in a normal week"],
        [t.villagesReached, "villages and communities we go into"],
        [t.churchesLed, "local churches led by our staff"],
        [t.churchesServed, "local churches we serve"],
      ]) +

      statCard(String(YEAR), [
        [t.schools, "schools and courses run"],
        [t.students, "students in them"],
        [t.cambodianStudents, "of those students were Cambodian"],
        [t.graduates, "graduated"],
        [t.teamsHosted, "teams hosted"],
        [t.outreachTeams, "outreach teams sent out"],
        [t.newBelievers, "new believers"],
        [t.baptisms, "baptisms"],
        [t.churchesPlanted, "churches planted"],
      ]) +

      '<div class="card">' +
        '<div class="sec-title" style="margin-bottom:10px">Who has reported</div>' +
        '<p class="who">' + who + "</p>" +
      "</div>" +

      '<div class="btn-row">' +
        '<button class="btn-ghost" data-action="download-csv">Download as a spreadsheet</button>' +
        '<button class="btn-ghost" data-action="load-results">Refresh</button>' +
      "</div>"
    );
  }

  // Most of these fields are optional, so a zero almost always means "nobody
  // filled it in" rather than "none". Printing a column of zeros would read as a
  // real finding, so an unreported line is left out and the card says how many.
  function statCard(title, lines) {
    var shown = lines.filter(function (l) { return l[0] > 0; });
    if (!shown.length) return "";
    var quiet = lines.length - shown.length;
    return (
      '<div class="card">' +
        '<div class="sec-head"><div class="sec-title">' + esc(title) + "</div>" +
          (quiet ? '<div class="sec-count">' + quiet + " not yet reported</div>" : "") +
        "</div>" +
        shown.map(function (l) {
          return '<div class="stat"><div class="stat-num num">' + fmt(l[0]) +
            '</div><div class="stat-cap">' + esc(l[1]) + "</div></div>";
        }).join("") +
      "</div>"
    );
  }

  // ---------- spreadsheet ----------

  function sumSchools(m, key) {
    return (m.schools || []).reduce(function (a, s) { return a + n(s[key]); }, 0);
  }

  var CSV_COLUMNS = [
    ["Reported by", function (r) { return r.leaderName; }],
    ["Their role", function (r) { return r.leaderRole; }],
    ["Province", function (r, m) { return provinceName(m.provinceId); }],
    ["Ministry", function (r, m) { return m.name; }],
    ["Ministry leader", function (r, m) { return m.leaderName; }],
    ["Location", function (r, m) {
      return m.placement === "campus" ? "Main base" : m.placement === "offsite" ? "Separate location" : "";
    }],
    ["Town / district", function (r, m) { return m.town; }],
    ["Started", function (r, m) { return m.startedYear; }],
    ["Ministry types", function (r, m) { return typeLabels(m).join("; "); }],
    ["Staff total", function (r, m) { return m.staffTotal; }],
    ["Staff Cambodian", function (r, m) { return m.staffCambodian; }],
    ["Staff international", function (r, m) { return m.staffInternational; }],
    ["Staff full-time", function (r, m) { return m.staffFullTime; }],
    ["Staff volunteer", function (r, m) { return m.staffVolunteer; }],
    ["Youth reached daily", function (r, m) { return m.youthDaily; }],
    ["Students enrolled now", function (r, m) { return m.currentStudents; }],
    ["People reached weekly", function (r, m) { return m.peopleWeekly; }],
    ["Villages reached", function (r, m) { return m.villagesReached; }],
    ["Village names", function (r, m) { return m.villageNames; }],
    ["Churches served", function (r, m) { return m.churchesServed; }],
    ["Churches led", function (r, m) { return m.churchesLed; }],
    ["Schools run " + YEAR, function (r, m) {
      return (m.schools || []).map(function (s) {
        return (schoolById[s.typeId] ? schoolById[s.typeId].label : s.typeId || "School") + (s.name ? " (" + s.name + ")" : "");
      }).join("; ");
    }],
    ["School students " + YEAR, function (r, m) { return sumSchools(m, "students"); }],
    ["School students Cambodian " + YEAR, function (r, m) { return sumSchools(m, "cambodianStudents"); }],
    ["Graduates " + YEAR, function (r, m) { return sumSchools(m, "graduates"); }],
    ["Teams hosted " + YEAR, function (r, m) { return m.teamsHosted; }],
    ["Outreach teams sent " + YEAR, function (r, m) { return m.outreachTeams; }],
    ["Churches planted " + YEAR, function (r, m) { return m.churchesPlanted; }],
    ["New believers " + YEAR, function (r, m) { return m.newBelievers; }],
    ["Baptisms " + YEAR, function (r, m) { return m.baptisms; }],
    ["Biggest need", function (r, m) { return m.biggestNeed; }],
    ["Prayer request", function (r, m) { return m.prayerRequest; }],
    ["Submitted", function (r) { return (r.submittedAt || "").slice(0, 10); }],
  ];

  function csvCell(v) {
    var s = v === undefined || v === null ? "" : String(v);
    // A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function downloadCsv() {
    var rows = [CSV_COLUMNS.map(function (c) { return csvCell(c[0]); }).join(",")];
    (state.results || []).forEach(function (r) {
      (r.ministries || []).forEach(function (m) {
        rows.push(CSV_COLUMNS.map(function (c) { return csvCell(c[1](r, m)); }).join(","));
      });
    });
    // The BOM is what makes Excel open Khmer and accented names correctly.
    var blob = new Blob(["﻿" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "ywam-cambodia-" + YEAR + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- network ----------

  function reportForSubmit() {
    var r = state.report;
    return {
      leaderName: r.leaderName.trim(),
      leaderRole: r.leaderRole.trim(),
      leaderContact: r.leaderContact.trim(),
      notes: r.notes.trim(),
      ministries: r.ministries.map(function (m) {
        var out = {};
        Object.keys(m).forEach(function (k) { out[k] = m[k]; });
        out.schools = (m.schools || []).filter(function (s) {
          return s.typeId || s.name || s.students !== "";
        });
        return out;
      }),
    };
  }

  function submit() {
    var r = state.report;
    if (!r.leaderName.trim()) {
      state.error = "Please put your name on step 1 so we know whose report this is.";
      state.step = "you";
      render();
      return;
    }
    if (!r.ministries.length) {
      state.error = "Add at least one ministry before sending.";
      render();
      return;
    }
    var incomplete = r.ministries.filter(function (m) { return missingFrom(m).length; });
    if (incomplete.length) {
      state.error = incomplete.length === 1
        ? "One ministry is still missing its name, leader or staff count."
        : incomplete.length + " ministries are still missing a name, leader or staff count.";
      render();
      return;
    }
    if (!state.passcode) {
      state.error = "The team passcode is missing.";
      render();
      return;
    }

    state.busy = true;
    state.error = "";
    render();

    fetch("/api/ministries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: state.passcode, report: reportForSubmit() }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (out) {
        state.busy = false;
        if (!out.ok) {
          state.error = (out.data && out.data.error) || "Could not send. Please try again.";
          render();
          return;
        }
        try { localStorage.setItem(PASS_KEY, state.passcode); } catch (e) { /* ignore */ }
        state.error = "";
        state.step = "done";
        state.results = null;
        render();
      })
      .catch(function () {
        state.busy = false;
        state.error = "No connection. Your report is saved on this phone — send again when you have signal.";
        render();
      });
  }

  function loadResults() {
    state.resultsError = "";
    state.loadingResults = true;
    render();

    // Anyone with the link can read the totals. The passcode is sent only so a
    // leader who has one also gets the contact details back.
    var url = "/api/ministries" + (state.passcode ? "?passcode=" + encodeURIComponent(state.passcode) : "");

    fetch(url)
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (out) {
        state.loadingResults = false;
        if (!out.ok) {
          state.resultsError = (out.data && out.data.error) || "Could not load the totals.";
          state.results = null;
        } else {
          state.results = out.data.reports || [];
        }
        render();
      })
      .catch(function () {
        state.loadingResults = false;
        state.resultsError = "No connection. Try again when you have signal.";
        state.results = null;
        render();
      });
  }

  // ---------- events ----------

  // Typing must never trigger a re-render — a re-render mid-word takes the
  // keyboard away. State is updated in place and only the card summary refreshes.
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!el || !el.dataset) return;

    if (el.dataset.pass !== undefined) {
      state.passcode = el.value;
      return;
    }
    if (el.dataset.bind) {
      state.report[el.dataset.bind] = el.value;
      saveDraft();
      return;
    }
    if (el.dataset.min && el.dataset.key) applyFieldChange(el);
  });

  // <select> fires change rather than input on some Android browsers.
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (!el || !el.dataset || !el.dataset.min || !el.dataset.key) return;
    applyFieldChange(el);
    // Moving a ministry to another province means it has to move block.
    if (el.dataset.key === "provinceId") render();
  });

  function applyFieldChange(el) {
    var m = findMinistry(el.dataset.min);
    if (!m) return;

    if (el.dataset.school) {
      var s = (m.schools || []).filter(function (x) { return x.id === el.dataset.school; })[0];
      if (!s) return;
      s[el.dataset.key] = el.value;
    } else {
      m[el.dataset.key] = el.value;
    }
    saveDraft();
    refreshSummary(m);
  }

  function refreshSummary(m) {
    var head = document.querySelector('.min-summary[data-toggle-ministry="' + m.id + '"]');
    if (!head) return;
    var name = head.querySelector(".min-summary-name");
    var sub = head.querySelector(".min-summary-sub");
    if (name) name.innerHTML = ministryLabel(m);
    if (sub) sub.innerHTML = ministrySub(m);
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest(
      "[data-goto],[data-action],[data-province],[data-add-ministry],[data-toggle-ministry],[data-remove-ministry],[data-type],[data-add-school],[data-remove-school]"
    );
    if (!el) return;
    var d = el.dataset;

    if (d.goto) {
      state.tab = d.goto;
      state.error = "";
      if (d.goto === "results" && !state.results) { loadResults(); return; }
      render();
      return;
    }

    if (d.province) { toggleProvince(d.province); return; }

    if (d.addMinistry) {
      var fresh = blankMinistry(d.addMinistry);
      state.report.ministries.push(fresh);
      state.openMinistry = fresh.id;
      saveDraft();
      render();
      return;
    }

    if (d.toggleMinistry) {
      state.openMinistry = state.openMinistry === d.toggleMinistry ? null : d.toggleMinistry;
      render();
      return;
    }

    if (d.removeMinistry) {
      var target = findMinistry(d.removeMinistry);
      var label = target && target.name ? '"' + target.name + '"' : "this ministry";
      if (!window.confirm("Remove " + label + " from your report?")) return;
      state.report.ministries = state.report.ministries.filter(function (m) { return m.id !== d.removeMinistry; });
      if (state.openMinistry === d.removeMinistry) state.openMinistry = null;
      saveDraft();
      render();
      return;
    }

    if (d.type && d.min) {
      var mt = findMinistry(d.min);
      if (!mt) return;
      var i = mt.types.indexOf(d.type);
      if (i === -1) mt.types.push(d.type); else mt.types.splice(i, 1);
      saveDraft();
      // "Other" opens a text box below, so that one needs a real re-render.
      if (d.type === "other") { render(); return; }
      el.classList.toggle("on");
      refreshSummary(mt);
      return;
    }

    if (d.addSchool) {
      var ms = findMinistry(d.addSchool);
      if (!ms) return;
      ms.schools.push(blankSchool());
      saveDraft();
      render();
      return;
    }

    if (d.removeSchool && d.min) {
      var mr = findMinistry(d.min);
      if (!mr) return;
      mr.schools = mr.schools.filter(function (s) { return s.id !== d.removeSchool; });
      saveDraft();
      render();
      return;
    }

    switch (d.action) {
      case "to-you":
        state.step = "you";
        state.error = "";
        render();
        break;
      case "to-ministries":
        if (state.step === "you" && !guardStepOne()) return;
        state.tab = "form";
        state.step = "ministries";
        state.error = "";
        render();
        break;
      case "to-review":
        state.step = "review";
        state.error = "";
        render();
        break;
      case "submit": submit(); break;
      case "see-results":
        state.tab = "results";
        loadResults();
        break;
      case "load-results": loadResults(); break;
      case "download-csv": downloadCsv(); break;
    }
  });

  function guardStepOne() {
    if (!state.report.leaderName.trim()) {
      state.error = "Please put your name in first.";
      render();
      return false;
    }
    if (!state.report.provinceIds.length) {
      state.error = "Pick at least one province.";
      render();
      return false;
    }
    return true;
  }

  function toggleProvince(pid) {
    var ids = state.report.provinceIds;
    var i = ids.indexOf(pid);
    if (i === -1) {
      ids.push(pid);
      // Keep the blocks in the same order as the picker so the two screens agree.
      ids.sort(function (a, b) { return provinceOrder[a] - provinceOrder[b]; });
    } else {
      var held = ministriesIn(pid);
      if (held.length) {
        var msg = provinceName(pid) + " has " + held.length + " " + plural(held.length, "ministry", "ministries") +
          " listed. Remove the province and " + plural(held.length, "it", "them") + "?";
        if (!window.confirm(msg)) return;
        state.report.ministries = state.report.ministries.filter(function (m) { return m.provinceId !== pid; });
      }
      ids.splice(i, 1);
    }
    saveDraft();
    render();
  }

  // ---------- go ----------

  loadDraft();
  if (state.report.ministries.length || state.report.provinceIds.length) state.step = "ministries";
  render();
})();
