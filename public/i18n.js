// Lightweight i18n: a flat key -> {en, km} dictionary and a t() helper.
//
// The Khmer text was translated directly (no machine-translation API was available in this
// environment) using standard Cambodian Protestant church vocabulary — e.g. "ក្រុមជំនុំ" for a
// church/congregation, "គ្រូគង្វាល" for pastor. Recommend a native Khmer-speaking pastor or
// leader proofread these before wide distribution, since denominational networks sometimes
// prefer different words for the same idea.
//
// Numbers, percentages, and dates are NOT translated — they stay in Arabic numerals /
// Intl-formatted dates, which is standard practice in Cambodian government and church apps.
(function () {
  "use strict";

  var DICT = {
    "app.title": { en: "Vision 2033", km: "និមិត្តឆ្នាំ២០៣៣" },
    "app.subtitle": { en: "Church growth tracker", km: "កម្មវិធីតាមដានកំណើនក្រុមជំនុំ" },
    "nav.dashboard": { en: "Dashboard", km: "ផ្ទាំងគ្រប់គ្រង" },
    "nav.entry": { en: "Enter Province Data", km: "បញ្ចូលទិន្នន័យខេត្ត" },

    "hero.eyebrow": { en: "Vision · Cambodia", km: "និមិត្ត · កម្ពុជា" },
    "hero.title": { en: "10% of Cambodia following Christ by 2033", km: "១០% នៃប្រជាជនកម្ពុជាដើរតាមព្រះគ្រិស្តត្រឹមឆ្នាំ២០៣៣" },
    "hero.sub": {
      en: "Senior pastors in every province report their numbers here so the whole movement can see, together, how close we are to the goal — and where prayer and workers are needed most.",
      km: "គ្រូគង្វាលនាំមុខនៅគ្រប់ខេត្តទាំងអស់ រាយការណ៍ចំនួនរបស់ខ្លួននៅទីនេះ ដើម្បីឲ្យចលនាទាំងមូលបានឃើញជាមួយគ្នា ថាយើងខិតជិតគោលដៅប៉ុណ្ណា — និងកន្លែងណាដែលត្រូវការការអធិស្ឋាន និងកម្មករបន្ថែម។",
    },
    "hero.figure.reported": { en: "reported so far, of a 10% goal", km: "បានរាយការណ៍មកទល់ពេលនេះ ក្នុងគោលដៅ ១០%" },
    "hero.figure.yearsLeft": { en: "years left", km: "ឆ្នាំទៀតទេ" },
    "hero.figure.noData": { en: "No provinces have reported yet", km: "មិនទាន់មានខេត្តណារាយការណ៍នៅឡើយទេ" },
    "hero.figure.yearsLeftToGoal": { en: "years left to reach the goal", km: "ឆ្នាំទៀត ដើម្បីទៅដល់គោលដៅ" },

    "stat.reportingProvinces": { en: "Reporting Provinces", km: "ខេត្តដែលបានរាយការណ៍" },
    "stat.totalPopulation": { en: "Total Population Reported", km: "ចំនួនប្រជាជនសរុបដែលបានរាយការណ៍" },
    "stat.totalPopulation.foot": { en: "across reporting provinces", km: "គិតចាប់ពីខេត្តដែលបានរាយការណ៍" },
    "stat.attendance": { en: "Christians Attending Sunday", km: "អ្នកជឿចូលរួមថ្ងៃអាទិត្យ" },
    "stat.attendance.foot": { en: "self-reported by pastors", km: "រាយការណ៍ដោយខ្លួនគ្រូគង្វាល" },
    "stat.villagesWithChurch": { en: "Villages With a Church", km: "ភូមិដែលមានក្រុមជំនុំ" },
    "stat.villagesWithChurch.foot": { en: "of reporting villages", km: "នៃភូមិដែលបានរាយការណ៍" },

    "goal.title": { en: "Progress toward 10% Christian by 2033", km: "វឌ្ឍនភាពឆ្ពោះទៅគោលដៅ ១០% ត្រឹមឆ្នាំ២០៣៣" },
    "goal.noData": { en: "No data yet", km: "មិនទាន់មានទិន្នន័យ" },
    "goal.labelStart": { en: "0%", km: "0%" },
    "goal.labelTarget": { en: "Goal: 10% by Jan 2033", km: "គោលដៅ៖ ១០% ត្រឹមខែមករា ២០៣៣" },
    "goal.researchEstimate": {
      en: "is the best available independent research estimate of Cambodia's current Christian population, nationally — not yet confirmed province-by-province. Source:",
      km: "គឺជាការប៉ាន់ស្មានស្រាវជ្រាវឯករាជ្យដ៏ល្អបំផុតដែលមាន សម្រាប់ចំនួនប្រជាជនគ្រិស្តបរិស័ទបច្ចុប្បន្នរបស់កម្ពុជា ថ្នាក់ជាតិ — មិនទាន់បានបញ្ជាក់ជាក់លាក់តាមខេត្តនៅឡើយទេ។ ប្រភព៖",
    },
    "goal.governmentFigure": {
      en: "For comparison, Cambodia's own government census reports:",
      km: "សម្រាប់ការប្រៀបធៀប ជំរឿនរបស់រដ្ឋាភិបាលកម្ពុជាខ្លួនឯងរាយការណ៍ថា៖",
    },
    "table.legend.estimated": {
      en: "Estimated = a research-based figure (see hover for source), not yet confirmed by that province's pastor. Confirm it by submitting a report.",
      km: "ប៉ាន់ស្មាន = លេខផ្អែកលើការស្រាវជ្រាវ (សូមមើលព័ត៌មានលម្អិតដោយចុចលើសញ្ញា) មិនទាន់បញ្ជាក់ដោយគ្រូគង្វាលខេត្តនោះទេ។ សូមបញ្ជាក់ដោយដាក់ស្នើរបាយការណ៍។",
    },
    "goal.emptyNote": {
      en: "No provinces have reported yet. Once pastors begin entering data, national progress will appear here.",
      km: "មិនទាន់មានខេត្តណារាយការណ៍នៅឡើយទេ។ នៅពេលគ្រូគង្វាលចាប់ផ្តើមបញ្ចូលទិន្នន័យ វឌ្ឍនភាពថ្នាក់ជាតិនឹងបង្ហាញនៅទីនេះ។",
    },

    "chart.title": { en: "National trend vs. goal pace", km: "និន្នាការថ្នាក់ជាតិ ធៀបនឹងល្បឿនគោលដៅ" },
    "chart.sub": {
      en: "Each point is the national total at the time a province submitted a report. The gold line shows the straight-line pace needed to reach 10% by 2033.",
      km: "ចំណុចនីមួយៗគឺជាចំនួនសរុបថ្នាក់ជាតិនៅពេលដែលខេត្តមួយដាក់ស្នើរបាយការណ៍។ បន្ទាត់ពណ៌មាសបង្ហាញអំពីល្បឿនដែលត្រូវការដើម្បីទៅដល់ ១០% ត្រឹមឆ្នាំ២០៣៣។",
    },
    "chart.actual": { en: "Actual % Christian (reported)", km: "% ជាក់ស្តែងគ្រិស្តបរិស័ទ (បានរាយការណ៍)" },
    "chart.goal": { en: "Pace needed for 10% by 2033", km: "ល្បឿនត្រូវការសម្រាប់ ១០% ត្រឹមឆ្នាំ២០៣៣" },
    "chart.target2033": { en: "Jan 2033", km: "មករា ២០៣៣" },
    "chart.today": { en: "Today", km: "ថ្ងៃនេះ" },
    "chart.fallback": { en: "Chart could not load (no internet connection to the chart library). The numbers above are still accurate.", km: "មិនអាចផ្ទុកក្រាបបានទេ (គ្មានការតភ្ជាប់អ៊ីនធឺណិតទៅបណ្ណាល័យក្រាប)។ ចំនួនខាងលើនៅតែត្រឹមត្រូវ។" },

    "table.title": { en: "By province", km: "តាមខេត្ត" },
    "table.sub": { en: "Click a province to see its full reporting history, or open its Village Registry.", km: "ចុចលើខេត្តណាមួយ ដើម្បីមើលប្រវត្តិរាយការណ៍ពេញលេញ ឬបើកបញ្ជីភូមិ។" },
    "table.province": { en: "Province", km: "ខេត្ត" },
    "table.population": { en: "Population", km: "ប្រជាជន" },
    "table.attendance": { en: "Sunday Attendance", km: "អ្នកចូលរួមថ្ងៃអាទិត្យ" },
    "table.percentChristian": { en: "% Christian", km: "% គ្រិស្តបរិស័ទ" },
    "table.villagesWithChurch": { en: "Villages with a Church", km: "ភូមិមានក្រុមជំនុំ" },
    "table.lastUpdated": { en: "Last Updated", km: "កាលបរិច្ឆេទថ្មីបំផុត" },
    "table.status": { en: "Status", km: "ស្ថានភាព" },
    "badge.reporting": { en: "Confirmed", km: "បានបញ្ជាក់" },
    "badge.estimated": { en: "Estimated", km: "ប៉ាន់ស្មាន" },
    "badge.noData": { en: "No data yet", km: "មិនទាន់មានទិន្នន័យ" },

    "back.dashboard": { en: "Back to dashboard", km: "ត្រឡប់ទៅផ្ទាំងគ្រប់គ្រង" },
    "detail.population": { en: "Population", km: "ប្រជាជន" },
    "detail.population.asOf": { en: "as of", km: "គិតត្រឹមថ្ងៃ" },
    "detail.population.noReports": { en: "No reports yet", km: "មិនទាន់មានរបាយការណ៍" },
    "detail.attendance": { en: "Sunday Attendance", km: "អ្នកចូលរួមថ្ងៃអាទិត្យ" },
    "detail.villagesWithChurch": { en: "Villages with a Church", km: "ភូមិមានក្រុមជំនុំ" },
    "detail.reportsSubmitted": { en: "Reports Submitted", km: "របាយការណ៍បានដាក់ស្នើ" },
    "detail.mostRecent": { en: "most recent", km: "ថ្មីបំផុត" },
    "detail.historyTitle": { en: "reporting history", km: "ប្រវត្តិរាយការណ៍" },
    "detail.noHistory": { en: "No data has been submitted for this province yet.", km: "មិនទាន់មានទិន្នន័យបានដាក់ស្នើសម្រាប់ខេត្តនេះនៅឡើយទេ។" },
    "detail.latestNotes": { en: "Latest report notes", km: "ចំណារបំផុតពីរបាយការណ៍ចុងក្រោយ" },
    "detail.noExtra": { en: "No additional details were reported.", km: "មិនមានព័ត៌មានលម្អិតបន្ថែមត្រូវបានរាយការណ៍ទេ។" },
    "detail.notesLabel": { en: "Notes", km: "ចំណារ" },
    "detail.enterNew": { en: "Enter a new report for", km: "បញ្ចូលរបាយការណ៍ថ្មីសម្រាប់" },
    "detail.openRegistry": { en: "Open Village Registry for", km: "បើកបញ្ជីភូមិសម្រាប់" },
    "detail.chartTitle": { en: "% Christian over time", km: "% គ្រិស្តបរិស័ទតាមពេលវេលា" },
    "detail.col.date": { en: "Date", km: "កាលបរិច្ឆេទ" },
    "detail.col.enteredBy": { en: "Entered By", km: "បញ្ចូលដោយ" },
    "detail.col.population": { en: "Population", km: "ប្រជាជន" },
    "detail.col.villages": { en: "Villages w/ Church", km: "ភូមិមានក្រុមជំនុំ" },
    "detail.col.attendance": { en: "Sunday Attendance", km: "អ្នកចូលរួមថ្ងៃអាទិត្យ" },
    "detail.col.percent": { en: "% Christian", km: "% គ្រិស្តបរិស័ទ" },
    "detail.extra.churches": { en: "Churches", km: "ចំនួនក្រុមជំនុំ" },
    "detail.extra.baptisms": { en: "Baptisms (past year)", km: "ពិធីជ្រមុជទឹក (ឆ្នាំមុន)" },
    "detail.extra.newBelievers": { en: "New believers (past year)", km: "អ្នកជឿថ្មី (ឆ្នាំមុន)" },
    "detail.extra.smallGroups": { en: "Small groups / house churches", km: "ក្រុមតូចៗ / ក្រុមជំនុំតាមផ្ទះ" },
    "detail.extra.trainedLeaders": { en: "Trained local leaders", km: "អ្នកដឹកនាំមូលដ្ឋានទទួលការបណ្តុះបណ្តាល" },

    "entry.title": { en: "Enter Province Report", km: "បញ្ចូលរបាយការណ៍ខេត្ត" },
    "entry.sub": {
      en: "To be completed by the senior pastor (or designated leader) for a province. Submit a new report any time your numbers change — it only takes a minute, and each submission is saved to that province's history.",
      km: "ត្រូវបំពេញដោយគ្រូគង្វាលនាំមុខ (ឬអ្នកដឹកនាំដែលបានតែងតាំង) របស់ខេត្តនីមួយៗ។ ដាក់ស្នើរបាយការណ៍ថ្មីនៅពេលណាដែលចំនួនរបស់អ្នកផ្លាស់ប្តូរ — ចំណាយពេលតែមួយនាទីប៉ុណ្ណោះ ហើយរបាយការណ៍នីមួយៗត្រូវបានរក្សាទុកក្នុងប្រវត្តិខេត្តនោះ។",
    },
    "entry.section1": { en: "Where and when", km: "នៅឯណា និងកាលបរិច្ឆេទ" },
    "entry.province": { en: "Province", km: "ខេត្ត" },
    "entry.provincePlaceholder": { en: "Select a province…", km: "ជ្រើសរើសខេត្ត…" },
    "entry.date": { en: "Report date", km: "កាលបរិច្ឆេទរបាយការណ៍" },
    "entry.enteredBy": { en: "Entered by", km: "បញ្ចូលដោយ" },
    "entry.enteredBy.hint": { en: "(pastor / leader name)", km: "(ឈ្មោះគ្រូគង្វាល / អ្នកដឹកនាំ)" },
    "entry.enteredBy.placeholder": { en: "e.g. Pastor Sok Dara", km: "ឧ. គ្រូគង្វាល សុខ ដារា" },

    "entry.section2": { en: "Population & villages", km: "ប្រជាជន និងភូមិ" },
    "entry.population": { en: "Total population of province", km: "ចំនួនប្រជាជនសរុបក្នុងខេត្ត" },
    "entry.villages": { en: "Total villages in province", km: "ចំនួនភូមិសរុបក្នុងខេត្ត" },
    "entry.villagesWithChurch": { en: "Villages with at least one church", km: "ភូមិដែលមានក្រុមជំនុំយ៉ាងហោចណាស់មួយ" },
    "entry.ref.label": { en: "Reference:", km: "សម្គាល់ជាមូលដ្ឋាន៖" },
    "entry.ref.use": { en: "use this number", km: "ប្រើលេខនេះ" },
    "entry.ref.caveat": { en: "if you don't have a more accurate local count.", km: "ប្រសិនបើអ្នកមិនមានចំនួនច្បាស់លាស់ជាងនេះនៅតាមមូលដ្ឋាន។" },
    "entry.ref.estimateLabel": { en: "Research estimate (not province-specific data — please replace with your real count):", km: "ការប៉ាន់ស្មានស្រាវជ្រាវ (មិនមែនទិន្នន័យជាក់លាក់ខេត្តទេ — សូមជំនួសដោយចំនួនពិតរបស់អ្នក)៖" },
    "entry.ref.villageNote": { en: "official government count — this updates automatically", km: "ចំនួនផ្លូវការរបស់រដ្ឋាភិបាល — លេខនេះកែប្រែស្វ័យប្រវត្តិ" },
    "entry.registryHint": { en: "Want church-by-church accuracy instead of one number? Use the", km: "ចង់បានភាពត្រឹមត្រូវជាក្រុមជំនុំម្តងៗ ជាជាងលេខតែមួយឬ? សូមប្រើ" },
    "entry.registryLink": { en: "Village Registry", km: "បញ្ជីភូមិ" },

    "entry.section3": { en: "This Sunday", km: "ថ្ងៃអាទិត្យនេះ" },
    "entry.attendance": { en: "Christians attending church this Sunday", km: "អ្នកជឿចូលរួមព្រះវិហារថ្ងៃអាទិត្យនេះ" },

    "entry.toggleExtra.show": { en: "+ Add optional details (churches, baptisms, new believers, leaders, notes)", km: "+ បន្ថែមព័ត៌មានលម្អិត (ក្រុមជំនុំ, ពិធីជ្រមុជទឹក, អ្នកជឿថ្មី, អ្នកដឹកនាំ, ចំណារ)" },
    "entry.toggleExtra.hide": { en: "− Hide optional details (churches, baptisms, new believers, leaders, notes)", km: "− លាក់ព័ត៌មានលម្អិត (ក្រុមជំនុំ, ពិធីជ្រមុជទឹក, អ្នកជឿថ្មី, អ្នកដឹកនាំ, ចំណារ)" },
    "entry.numChurches": { en: "Total number of churches", km: "ចំនួនក្រុមជំនុំសរុប" },
    "entry.numChurches.hint": { en: "(may be more than villages with a church)", km: "(អាចច្រើនជាងចំនួនភូមិដែលមានក្រុមជំនុំ)" },
    "entry.leaders": { en: "Trained / ordained local leaders", km: "អ្នកដឹកនាំមូលដ្ឋានទទួលការបណ្តុះបណ្តាល / តែងតាំង" },
    "entry.baptisms": { en: "Baptisms in the past year", km: "ពិធីជ្រមុជទឹកក្នុងឆ្នាំមុន" },
    "entry.newBelievers": { en: "New believers in the past year", km: "អ្នកជឿថ្មីក្នុងឆ្នាំមុន" },
    "entry.smallGroups": { en: "Small groups / house churches / cell groups", km: "ក្រុមតូចៗ / ក្រុមជំនុំតាមផ្ទះ" },
    "entry.notes": { en: "Notes or prayer requests", km: "ចំណារ ឬសំណើអធិស្ឋាន" },
    "entry.notes.placeholder": { en: "Anything the national team should know — needs, breakthroughs, prayer requests…", km: "អ្វីៗដែលក្រុមថ្នាក់ជាតិគួរដឹង — តម្រូវការ, ភាពរីកចម្រើន, សំណើអធិស្ឋាន…" },
    "entry.passcode": { en: "Team passcode", km: "លេខសម្ងាត់ក្រុម" },
    "entry.passcode.placeholder": { en: "Provided by your regional coordinator", km: "ផ្តល់ដោយអ្នកសម្របសម្រួលតំបន់របស់អ្នក" },
    "entry.passcode.remembered": { en: "Saved on this device so you won't need to retype it next time.", km: "រក្សាទុកនៅលើឧបករណ៍នេះ ដូច្នេះអ្នកមិនចាំបាច់វាយបញ្ចូលម្តងទៀតទេ។" },
    "entry.submit": { en: "Submit report", km: "ដាក់ស្នើរបាយការណ៍" },
    "entry.submitting": { en: "Submitting…", km: "កំពុងដាក់ស្នើ…" },
    "entry.success": { en: "Report saved for", km: "របាយការណ៍បានរក្សាទុកសម្រាប់" },
    "entry.thankyou": { en: "Thank you!", km: "សូមអរគុណ!" },
    "entry.error.selectProvince": { en: "Please select a province.", km: "សូមជ្រើសរើសខេត្តមួយ។" },
    "entry.error.villagesExceed": { en: "Villages with a church can't be more than total villages. Please check your numbers.", km: "ភូមិដែលមានក្រុមជំនុំមិនអាចច្រើនជាងចំនួនភូមិសរុបបានទេ។ សូមពិនិត្យលេខរបស់អ្នកឡើងវិញ។" },
    "entry.error.attendanceExceed": { en: "Sunday attendance can't be more than the total population. Please check your numbers.", km: "អ្នកចូលរួមថ្ងៃអាទិត្យមិនអាចច្រើនជាងចំនួនប្រជាជនសរុបបានទេ។ សូមពិនិត្យលេខរបស់អ្នកឡើងវិញ។" },
    "entry.feedback.percentOfPop": { en: "of the province's population", km: "នៃចំនួនប្រជាជនក្នុងខេត្ត" },
    "entry.feedback.percentVillages": { en: "of villages have a church", km: "នៃភូមិមានក្រុមជំនុំ" },

    "registry.title": { en: "Village Registry", km: "បញ្ជីភូមិ" },
    "registry.sub": {
      en: "Every village in this province, from Cambodia's official commune/village gazetteer. Mark which ones have a church so the province total stays accurate and specific.",
      km: "ភូមិទាំងអស់ក្នុងខេត្តនេះ គិតតាមបញ្ជីឃុំ/ភូមិផ្លូវការរបស់កម្ពុជា។ សូមគូសសម្គាល់ភូមិណាមានក្រុមជំនុំ ដើម្បីឲ្យចំនួនសរុបរបស់ខេត្តមានភាពត្រឹមត្រូវ និងច្បាស់លាស់។",
    },
    "registry.search": { en: "Search villages, communes, or districts…", km: "ស្វែងរកភូមិ ឃុំ ឬស្រុក…" },
    "registry.summary": { en: "villages have a church", km: "ភូមិមានក្រុមជំនុំ" },
    "registry.summary.one": { en: "village has a church", km: "ភូមិមានក្រុមជំនុំ" },
    "registry.of": { en: "of", km: "ក្នុងចំណោម" },
    "registry.hasChurch": { en: "Has a church", km: "មានក្រុមជំនុំ" },
    "registry.notePlaceholder": { en: "Church name (optional)", km: "ឈ្មោះក្រុមជំនុំ (មិនចាំបាច់)" },
    "registry.district": { en: "District", km: "ស្រុក" },
    "registry.commune": { en: "Commune", km: "ឃុំ" },
    "registry.villages": { en: "villages", km: "ភូមិ" },
    "registry.loading": { en: "Loading village list…", km: "កំពុងផ្ទុកបញ្ជីភូមិ…" },
    "registry.saveError": { en: "Couldn't save — check your passcode and connection.", km: "មិនអាចរក្សាទុកបានទេ — សូមពិនិត្យលេខសម្ងាត់ និងការតភ្ជាប់របស់អ្នក។" },
    "registry.passcodeNeeded": { en: "Enter your team passcode to mark villages", km: "សូមបញ្ចូលលេខសម្ងាត់ក្រុមរបស់អ្នក ដើម្បីគូសសម្គាល់ភូមិ" },
    "registry.noResults": { en: "No villages match your search.", km: "គ្មានភូមិត្រូវនឹងការស្វែងរករបស់អ្នកទេ។" },
    "registry.dataSource": { en: "Village names from the official NCDD commune/village gazetteer.", km: "ឈ្មោះភូមិយកមកពីបញ្ជីឃុំ/ភូមិផ្លូវការរបស់ NCDD។" },
    "registry.saved": { en: "Saved", km: "បានរក្សាទុក" },

    "pitch.bilingual": { en: "Bilingual — English & Khmer", km: "ភាសាពីរ — អង់គ្លេស និងខ្មែរ" },
    "pitch.villages": { en: "Every real village, from official government records", km: "ភូមិពិតៗគ្រប់មួយ ពីកំណត់ត្រារបស់រដ្ឋាភិបាល" },
    "pitch.together": { en: "The whole movement, visible together, in real time", km: "ចលនាទាំងមូល មើលឃើញជាមួយគ្នា ក្នុងពេលជាក់ស្តែង" },

    "footer.text": {
      en: "Built for provincial pastors to report on church planting progress toward the goal of 10% of Cambodia's population following Christ by 2033.",
      km: "បង្កើតឡើងសម្រាប់គ្រូគង្វាលថ្នាក់ខេត្ត ដើម្បីរាយការណ៍អំពីវឌ្ឍនភាពនៃការដាំក្រុមជំនុំ ឆ្ពោះទៅគោលដៅ ១០% នៃប្រជាជនកម្ពុជាដើរតាមព្រះគ្រិស្តត្រឹមឆ្នាំ២០៣៣។",
    },
    "loading": { en: "Loading province data…", km: "កំពុងផ្ទុកទិន្នន័យខេត្ត…" },
    "error.loadFailed": { en: "Could not load data:", km: "មិនអាចផ្ទុកទិន្នន័យបានទេ៖" },
    "error.retry": { en: "Try again", km: "សាកល្បងម្តងទៀត" },
  };

  var LANG_KEY = "vision2033:lang";

  function detectDefault() {
    try {
      var nav = (navigator.language || "").toLowerCase();
      if (nav.indexOf("km") === 0) return "km";
    } catch (e) {}
    return "en";
  }

  function getLang() {
    try {
      return localStorage.getItem(LANG_KEY) || detectDefault();
    } catch (e) {
      return "en";
    }
  }

  function setLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {}
    document.documentElement.setAttribute("lang", lang);
    listeners.forEach(function (fn) {
      fn(lang);
    });
  }

  var listeners = [];
  function onChange(fn) {
    listeners.push(fn);
  }

  function t(key) {
    var entry = DICT[key];
    if (!entry) return key;
    var lang = getLang();
    return entry[lang] || entry.en || key;
  }

  document.documentElement.setAttribute("lang", getLang());

  window.I18N = { t: t, getLang: getLang, setLang: setLang, onChange: onChange };
})();
