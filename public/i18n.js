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
    "nav.registry": { en: "Villages", km: "ភូមិ" },
    "nav.goal": { en: "2033", km: "២០៣៣" },
    "nav.church": { en: "My Church", km: "ក្រុមជំនុំរបស់ខ្ញុំ" },

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
    "submit.villages": { en: "How many villages have a church?", km: "តើមានភូមិប៉ុន្មានដែលមានក្រុមជំនុំ?" },
    "submit.villages.has": { en: "Your province has", km: "ខេត្តរបស់អ្នកមាន" },
    "submit.villages.total": { en: "villages", km: "ភូមិ" },
    "submit.villages.pick": { en: "Choose your province first", km: "សូមជ្រើសរើសខេត្តរបស់អ្នកជាមុនសិន" },
    "submit.confidence": { en: "How sure are you?", km: "តើអ្នកប្រាកដកម្រិតណា?" },
    "submit.name": { en: "Your name", km: "ឈ្មោះរបស់អ្នក" },
    "submit.name.placeholder": { en: "e.g. Pastor Sok Dara", km: "ឧ. គ្រូគង្វាល សុខ ដារា" },
    "submit.passcode": { en: "Team passcode", km: "លេខសម្ងាត់ក្រុម" },
    "submit.passcode.placeholder": { en: "From your coordinator", km: "ពីអ្នកសម្របសម្រួលរបស់អ្នក" },
    "submit.as": { en: "Reporting as", km: "រាយការណ៍ក្នុងនាម" },
    "submit.button": { en: "Send", km: "ផ្ញើ" },
    "submit.sending": { en: "Sending…", km: "កំពុងផ្ញើ…" },
    "submit.thanks": { en: "Thank you — saved.", km: "អរគុណ — បានរក្សាទុក។" },
    "submit.again": { en: "Send another", km: "ផ្ញើម្តងទៀត" },

    // Confidence bands
    "conf.low": { en: "Rough guess", km: "ស្មានប្រហាក់ប្រហែល" },
    "conf.mid": { en: "Fairly sure", km: "ប្រាកដល្មម" },
    "conf.high": { en: "Very sure", km: "ប្រាកដខ្លាំង" },

    // Village registry
    "reg.pick": { en: "Choose your province", km: "ជ្រើសរើសខេត្តរបស់អ្នក" },
    "reg.intro": {
      en: "Mark each village that has a church. Counted separately from the estimate.",
      km: "សូមគូសសម្គាល់ភូមិនីមួយៗដែលមានក្រុមជំនុំ។ រាប់ដោយឡែកពីការប៉ាន់ស្មាន។",
    },
    "reg.back": { en: "All provinces", km: "ខេត្តទាំងអស់" },
    "reg.marked": { en: "marked", km: "បានគូស" },
    "reg.of": { en: "of", km: "ក្នុងចំណោម" },
    "reg.search": { en: "Search a village or commune", km: "ស្វែងរកភូមិ ឬឃុំ" },
    "reg.noResults": { en: "No match.", km: "រកមិនឃើញ។" },
    "reg.more": { en: "more — keep typing to narrow", km: "ទៀត — សូមវាយបន្ថែមដើម្បីបង្រួម" },
    "reg.passcode": { en: "Team passcode to mark villages", km: "លេខសម្ងាត់ក្រុមដើម្បីគូសសម្គាល់ភូមិ" },
    "reg.saveError": {
      en: "Couldn't save — check your passcode and connection.",
      km: "មិនអាចរក្សាទុកបានទេ — សូមពិនិត្យលេខសម្ងាត់ និងការតភ្ជាប់របស់អ្នក។",
    },
    "reg.confirmed": { en: "confirmed village by village", km: "បានបញ្ជាក់ម្តងមួយភូមិ" },
    "reg.estimated": { en: "estimated by leaders", km: "ប៉ាន់ស្មានដោយអ្នកដឹកនាំ" },

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


    // ---------- Accounts ----------
    "auth.signin.title": { en: "Sign in", km: "ចូលប្រើ" },
    "auth.signup.title": { en: "Create an account", km: "បង្កើតគណនី" },
    "auth.intro": {
      en: "Sign in with your phone number so your church is on the map and your provincial leader can reach you.",
      km: "សូមចូលប្រើដោយប្រើលេខទូរស័ព្ទរបស់អ្នក ដើម្បីឱ្យក្រុមជំនុំរបស់អ្នកមានក្នុងបញ្ជី និងឱ្យអ្នកដឹកនាំខេត្តអាចទាក់ទងអ្នកបាន។",
    },
    "auth.phone": { en: "Phone number", km: "លេខទូរស័ព្ទ" },
    "auth.phone.placeholder": { en: "012 345 678", km: "០១២ ៣៤៥ ៦៧៨" },
    "auth.pin": { en: "PIN", km: "លេខសម្ងាត់ PIN" },
    "auth.pin.hint": { en: "4 to 8 numbers you'll remember", km: "លេខ ៤ ដល់ ៨ តួដែលអ្នកចងចាំបាន" },
    "auth.pin.confirm": { en: "PIN again", km: "បញ្ជាក់លេខសម្ងាត់ PIN ម្តងទៀត" },
    "auth.code": { en: "Team code", km: "កូដក្រុម" },
    "auth.code.hint": { en: "From your coordinator", km: "ពីអ្នកសម្របសម្រួលរបស់អ្នក" },
    "auth.signin.button": { en: "Sign in", km: "ចូលប្រើ" },
    "auth.signup.button": { en: "Create account", km: "បង្កើតគណនី" },
    "auth.toSignup": { en: "No account yet? Create one", km: "មិនទាន់មានគណនី? សូមបង្កើតថ្មី" },
    "auth.toSignin": { en: "Already have an account? Sign in", km: "មានគណនីរួចហើយ? សូមចូលប្រើ" },
    "auth.signout": { en: "Sign out", km: "ចេញពីគណនី" },
    "auth.working": { en: "Please wait…", km: "សូមរង់ចាំ…" },

    "err.pinMatch": { en: "The two PINs don't match.", km: "លេខសម្ងាត់ PIN ទាំងពីរមិនដូចគ្នាទេ។" },
    "err.pin": { en: "Choose a PIN of 4 to 8 numbers.", km: "សូមជ្រើសរើសលេខសម្ងាត់ PIN ៤ ដល់ ៨ តួ។" },
    "err.phone": { en: "Enter your phone number.", km: "សូមបញ្ចូលលេខទូរស័ព្ទរបស់អ្នក។" },
    "err.name": { en: "Enter your name.", km: "សូមបញ្ចូលឈ្មោះរបស់អ្នក។" },

    // ---------- My Church ----------
    "church.profile": { en: "Your church", km: "ក្រុមជំនុំរបស់អ្នក" },
    "church.churchName": { en: "Church name", km: "ឈ្មោះក្រុមជំនុំ" },
    "church.churchName.placeholder": { en: "e.g. Grace Church, Chhuk", km: "ឧ. ក្រុមជំនុំព្រះគុណ ជ្រៃ" },
    "church.denomination": { en: "Denomination", km: "និកាយ" },
    "church.denomination.placeholder": { en: "e.g. Cambodian Evangelical Church", km: "ឧ. គ្រិស្តសាសនាចក្រផ្សាយដំណឹងល្អកម្ពុជា" },
    "church.congregation": { en: "Congregation on a Sunday", km: "សមាជិកក្រុមជំនុំនៅថ្ងៃអាទិត្យ" },
    "church.congregation.hint": {
      en: "Count the people who come, not the members on paper.",
      km: "សូមរាប់មនុស្សដែលមកចូលរួមពិតប្រាកដ មិនមែនសមាជិកតាមឯកសារទេ។",
    },
    "church.men": { en: "Men", km: "បុរស" },
    "church.women": { en: "Women", km: "ស្ត្រី" },
    "church.children": { en: "Children", km: "កុមារ" },
    "church.total": { en: "Total", km: "សរុប" },
    "church.villages": { en: "Villages you serve", km: "ភូមិដែលអ្នកបម្រើ" },
    "church.villages.search": { en: "Search a village to add", km: "ស្វែងរកភូមិដើម្បីបញ្ចូល" },
    "church.villages.none": { en: "No villages added yet.", km: "មិនទាន់បានបញ្ចូលភូមិនៅឡើយ។" },
    "church.villages.pickProvince": { en: "Choose your province first.", km: "សូមជ្រើសរើសខេត្តរបស់អ្នកជាមុនសិន។" },
    "church.villages.remove": { en: "Remove", km: "លុប" },
    "church.save": { en: "Save", km: "រក្សាទុក" },
    "church.saving": { en: "Saving…", km: "កំពុងរក្សាទុក…" },
    "church.saved": { en: "Saved.", km: "បានរក្សាទុក។" },

    "church.contacts": { en: "Who to call", km: "អ្នកដែលអាចទាក់ទង" },
    "church.leader": { en: "Your provincial church leader", km: "អ្នកដឹកនាំក្រុមជំនុំខេត្តរបស់អ្នក" },
    "church.leader.none": {
      en: "No provincial leader named for your province yet.",
      km: "មិនទាន់មានការតែងតាំងអ្នកដឹកនាំសម្រាប់ខេត្តរបស់អ្នកនៅឡើយ។",
    },
    "church.director": { en: "Church committee director", km: "នាយកគណៈកម្មការក្រុមជំនុំ" },
    "church.call": { en: "Call", km: "ហៅទូរស័ព្ទ" },
    "church.you": { en: "That's you", km: "នោះជាអ្នក" },
    "church.setProvince": {
      en: "Choose your province and save, and your provincial leader will show here.",
      km: "សូមជ្រើសរើសខេត្តរបស់អ្នក ហើយរក្សាទុក បន្ទាប់មកអ្នកដឹកនាំខេត្តនឹងបង្ហាញនៅទីនេះ។",
    },

    "church.pin.change": { en: "Change PIN", km: "ប្តូរលេខសម្ងាត់ PIN" },
    "church.pin.current": { en: "Current PIN", km: "លេខសម្ងាត់ PIN បច្ចុប្បន្ន" },
    "church.pin.new": { en: "New PIN", km: "លេខសម្ងាត់ PIN ថ្មី" },
    "church.pin.changed": { en: "PIN changed.", km: "បានប្តូរលេខសម្ងាត់ PIN ។" },

    "role.pastor": { en: "Pastor", km: "គ្រូគង្វាល" },
    "role.leader": { en: "Provincial leader", km: "អ្នកដឹកនាំខេត្ត" },
    "role.director": { en: "Committee director", km: "នាយកគណៈកម្មការ" },

    // ---------- Leader roster ----------
    "roster.title": { en: "Churches in your province", km: "ក្រុមជំនុំក្នុងខេត្តរបស់អ្នក" },
    "roster.titleAll": { en: "Every church signed up", km: "ក្រុមជំនុំទាំងអស់ដែលបានចុះឈ្មោះ" },
    "roster.intro": {
      en: "What the congregations add up to. Use it to sharpen your province total — it is a floor, not the whole province.",
      km: "ចំនួនសមាជិកក្រុមជំនុំបូកបញ្ចូលគ្នា។ សូមប្រើវាដើម្បីកែសម្រួលចំនួនសរុបនៃខេត្តរបស់អ្នក — វាជាចំនួនអប្បបរមា មិនមែនទាំងខេត្តទេ។",
    },
    "roster.sum": { en: "Congregations add up to", km: "សមាជិកក្រុមជំនុំបូកបញ្ចូលគ្នាបាន" },
    "roster.churches": { en: "churches reporting", km: "ក្រុមជំនុំបានរាយការណ៍" },
    "roster.yourEstimate": { en: "Your province total", km: "ចំនួនសរុបនៃខេត្តរបស់អ្នក" },
    "roster.use": { en: "Use this in Submit →", km: "ប្រើលេខនេះក្នុងការដាក់ស្នើ →" },
    "roster.none": {
      en: "No pastors in your province have signed up yet. Share the team code.",
      km: "មិនទាន់មានគ្រូគង្វាលក្នុងខេត្តរបស់អ្នកចុះឈ្មោះនៅឡើយ។ សូមចែករំលែកកូដក្រុម។",
    },
    "roster.noNumbers": { en: "no numbers yet", km: "មិនទាន់មានលេខ" },
    "roster.makeLeader": { en: "Make provincial leader", km: "តែងតាំងជាអ្នកដឹកនាំខេត្ត" },
    "roster.noProvince": { en: "no province set", km: "មិនបានកំណត់ខេត្ត" },
    "roster.villagesServed": { en: "villages", km: "ភូមិ" },
    "roster.villageServed": { en: "village", km: "ភូមិ" },

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
