// Lightweight i18n: a flat key -> {en, km} dictionary and a t() helper.
//
// The Khmer text uses standard Cambodian Protestant church vocabulary — e.g. "គ្រិស្តបរិស័ទ"
// for Christians, "ក្រុមជំនុំ" for a church/congregation, "គ្រូគង្វាល" for pastor. Recommend a
// native Khmer-speaking pastor or leader proofread these before wide distribution.
//
// Numbers and percentages are NOT translated — they stay in Arabic numerals, which is
// standard practice in Cambodian government and church apps.
(function () {
  "use strict";

  var DICT = {
    "app.title": { en: "Vision 2033", km: "និមិត្តឆ្នាំ២០៣៣" },
    "app.subtitle": { en: "Christians in Cambodia", km: "គ្រិស្តបរិស័ទនៅកម្ពុជា" },

    "nav.dashboard": { en: "Total", km: "សរុប" },
    "nav.submit": { en: "Submit", km: "ដាក់ស្នើ" },
    "nav.goal": { en: "2033", km: "២០៣៣" },

    // Dashboard
    "dash.total": { en: "Christians", km: "គ្រិស្តបរិស័ទ" },
    "dash.from": { en: "from", km: "ពី" },
    "dash.ofProvinces": { en: "of 25 provinces", km: "ក្នុងចំណោម ២៥ ខេត្ត" },
    "dash.percent": { en: "of their population", km: "នៃចំនួនប្រជាជនរបស់ពួកគេ" },
    "dash.villagesLine": { en: "villages have a church", km: "ភូមិមានក្រុមជំនុំ" },
    "dash.empty.title": { en: "No numbers yet", km: "មិនទាន់មានលេខនៅឡើយ" },
    "dash.empty.body": {
      en: "The first province to submit will show up here.",
      km: "ខេត្តដំបូងដែលដាក់ស្នើនឹងបង្ហាញនៅទីនេះ។",
    },
    "dash.cta": { en: "Submit your province →", km: "ដាក់ស្នើខេត្តរបស់អ្នក →" },

    "table.province": { en: "Province", km: "ខេត្ត" },
    "table.christians": { en: "Christians", km: "គ្រិស្តបរិស័ទ" },
    "table.confidence": { en: "Confidence", km: "ទំនុកចិត្ត" },
    "table.villages": { en: "villages", km: "ភូមិ" },

    "dash.waiting": { en: "Not yet reported", km: "មិនទាន់រាយការណ៍" },
    "dash.by": { en: "by", km: "ដោយ" },

    // Submit
    "submit.province": { en: "Province", km: "ខេត្ត" },
    "submit.choose": { en: "Choose…", km: "ជ្រើសរើស…" },
    "submit.howMany": {
      en: "About how many Christians are there?",
      km: "តើមានគ្រិស្តបរិស័ទប្រហែលប៉ុន្មាននាក់?",
    },
    "submit.howMany.hint": { en: "Your best guess is fine", km: "ការស្មានដ៏ល្អបំផុតរបស់អ្នកគឺគ្រប់គ្រាន់" },
    "submit.villages": { en: "How many of those villages have a church?", km: "តើភូមិទាំងនោះប៉ុន្មានមានក្រុមជំនុំ?" },
    "submit.villages.has": { en: "Your province has", km: "ខេត្តរបស់អ្នកមាន" },
    "submit.villages.total": { en: "villages", km: "ភូមិ" },
    "submit.villages.pick": { en: "Choose your province first", km: "សូមជ្រើសរើសខេត្តរបស់អ្នកជាមុនសិន" },
    "submit.confidence": { en: "How sure are you?", km: "តើអ្នកប្រាកដកម្រិតណា?" },
    "submit.name": { en: "Your name", km: "ឈ្មោះរបស់អ្នក" },
    "submit.name.placeholder": { en: "e.g. Pastor Sok Dara", km: "ឧ. គ្រូគង្វាល សុខ ដារា" },
    "submit.passcode": { en: "Team passcode", km: "លេខសម្ងាត់ក្រុម" },
    "submit.passcode.placeholder": { en: "From your coordinator", km: "ពីអ្នកសម្របសម្រួលរបស់អ្នក" },
    "submit.button": { en: "Send", km: "ផ្ញើ" },
    "submit.sending": { en: "Sending…", km: "កំពុងផ្ញើ…" },
    "submit.thanks": { en: "Thank you — saved.", km: "អរគុណ — បានរក្សាទុក។" },
    "submit.again": { en: "Send another", km: "ផ្ញើម្តងទៀត" },

    // Confidence bands
    "conf.low": { en: "Rough guess", km: "ស្មានប្រហាក់ប្រហែល" },
    "conf.mid": { en: "Fairly sure", km: "ប្រាកដល្មម" },
    "conf.high": { en: "Very sure", km: "ប្រាកដខ្លាំង" },

    // 2033
    "goal.title": { en: "Where this is going", km: "ទិសដៅនៃដំណើរនេះ" },
    "goal.now": { en: "now", km: "ឥឡូវនេះ" },
    "goal.target": { en: "the 2033 goal", km: "គោលដៅឆ្នាំ២០៣៣" },
    "goal.scope": {
      en: "In the provinces that have reported so far",
      km: "នៅក្នុងខេត្តដែលបានរាយការណ៍រហូតមកដល់ពេលនេះ",
    },
    "goal.needed": { en: "More people to reach 10% in those provinces", km: "មនុស្សបន្ថែមដើម្បីឈានដល់ ១០% ក្នុងខេត្តទាំងនោះ" },
    "goal.perYear": { en: "per year", km: "ក្នុងមួយឆ្នាំ" },
    "goal.years": { en: "years left", km: "ឆ្នាំទៀត" },
    "goal.villages": { en: "Villages with a church", km: "ភូមិដែលមានក្រុមជំនុំ" },
    "goal.villagesNone": { en: "Villages without one", km: "ភូមិដែលគ្មាន" },
    "goal.partial": {
      en: "These figures cover only the provinces that have reported. They are not a national total.",
      km: "តួលេខទាំងនេះគ្របដណ្តប់តែខេត្តដែលបានរាយការណ៍ប៉ុណ្ណោះ។ វាមិនមែនជាចំនួនសរុបទូទាំងប្រទេសទេ។",
    },
    "goal.empty": {
      en: "Once provinces start reporting, this shows how far there is to go.",
      km: "នៅពេលខេត្តចាប់ផ្តើមរាយការណ៍ ទំព័រនេះនឹងបង្ហាញពីចម្ងាយដែលនៅសល់។",
    },

    // Errors
    "err.province": { en: "Choose a province.", km: "សូមជ្រើសរើសខេត្ត។" },
    "err.number": { en: "Enter a number.", km: "សូមបញ្ចូលលេខ។" },
    "err.villages": { en: "Enter how many villages have a church.", km: "សូមបញ្ចូលចំនួនភូមិដែលមានក្រុមជំនុំ។" },
    "err.villagesMax": {
      en: "That's more villages than the province has.",
      km: "នោះលើសពីចំនួនភូមិដែលខេត្តនេះមាន។",
    },
    "err.confidence": { en: "Choose how sure you are.", km: "សូមជ្រើសរើសកម្រិតប្រាកដរបស់អ្នក។" },
    "err.passcode": { en: "Enter the team passcode.", km: "សូមបញ្ចូលលេខសម្ងាត់ក្រុម។" },
    "err.generic": { en: "Couldn't save. Check your connection.", km: "មិនអាចរក្សាទុកបានទេ។ សូមពិនិត្យការតភ្ជាប់។" },

    "footer": {
      en: "Population: 2024 Inter-Censal Population Survey (NIS). Villages: official NCDD gazetteer.",
      km: "ប្រជាជន៖ អង្កេតប្រជាជនពាក់កណ្តាលជំរឿន ២០២៤ (NIS)។ ភូមិ៖ បញ្ជីរាយនាម NCDD ផ្លូវការ។",
    },
  };

  var STORAGE_KEY = "vision2033.lang";
  var lang = "en";
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "km") lang = saved;
  } catch (e) {}

  function t(key) {
    var row = DICT[key];
    if (!row) return key;
    return row[lang] || row.en || key;
  }

  function setLang(next) {
    lang = next === "km" ? "km" : "en";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
    document.documentElement.lang = lang === "km" ? "km" : "en";
    document.body.classList.toggle("km", lang === "km");
  }

  function getLang() {
    return lang;
  }

  function provinceName(p) {
    return lang === "km" && p.nameKhmer ? p.nameKhmer : p.name;
  }

  window.I18N = { t: t, setLang: setLang, getLang: getLang, provinceName: provinceName };
})();
