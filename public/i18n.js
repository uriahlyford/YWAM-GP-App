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
    "nav.pace": { en: "Pace to 2033", km: "ល្បឿនទៅ២០៣៣" },
    "nav.registry": { en: "Village Registry", km: "បញ្ជីភូមិ" },

    "pace.title": { en: "Pace needed vs. pace actual", km: "ល្បឿនដែលត្រូវការ ធៀបនឹងល្បឿនជាក់ស្តែង" },
    "pace.sub": {
      en: "What reaching 10% by 2033 actually requires, year by year — and where today's rate of growth would land instead.",
      km: "អ្វីដែលការឈានទៅដល់ ១០% ត្រឹមឆ្នាំ២០៣៣ ទាមទារជាក់ស្តែង ម្តងមួយឆ្នាំ — និងកន្លែងដែលអត្រាកំណើនសព្វថ្ងៃនឹងទៅដល់។",
    },
    "pace.today": { en: "today", km: "ថ្ងៃនេះ" },
    "pace.headline.today": { en: "Where we are today", km: "កន្លែងដែលយើងនៅសព្វថ្ងៃ" },
    "pace.headline.goal": { en: "The 2033 goal", km: "គោលដៅឆ្នាំ២០៣៣" },
    "pace.headline.trajectory": { en: "Where today's growth rate lands in 2033", km: "កន្លែងដែលអត្រាកំណើនសព្វថ្ងៃនឹងទៅដល់ក្នុងឆ្នាំ២០៣៣" },
    "pace.verdict.lead": { en: "At the current rate of growth, 2033 arrives", km: "តាមអត្រាកំណើនបច្ចុប្បន្ន ឆ្នាំ២០៣៣នឹងមកដល់ដោយខ្វះ" },
    "pace.verdict.short": { en: "people short", km: "នាក់" },
    "pace.verdict.tail": {
      en: "of the goal. That gap is the whole point of this page — not to discourage, but to make it concrete enough to plan around.",
      km: "ពីគោលដៅ។ គម្លាតនោះគឺជាចំណុចសំខាន់នៃទំព័រនេះ — មិនមែនដើម្បីធ្វើឲ្យបាក់ទឹកចិត្តទេ ប៉ុន្តែដើម្បីធ្វើឲ្យវាច្បាស់លាស់គ្រប់គ្រាន់សម្រាប់ការរៀបចំផែនការ។",
    },

    "pace.chart.required": { en: "Pace needed for 10% by 2033", km: "ល្បឿនត្រូវការសម្រាប់ ១០% ត្រឹមឆ្នាំ២០៣៣" },
    "pace.chart.trajectory": { en: "Current growth rate continued", km: "អត្រាកំណើនបច្ចុប្បន្នបន្តទៅ" },

    "pace.assumptions.title": { en: "Assumptions — change these and everything above recalculates", km: "ការសន្មត់ — ផ្លាស់ប្តូរទាំងនេះ នោះអ្វីៗខាងលើនឹងគណនាឡើងវិញ" },
    "pace.assumptions.popGrowth": { en: "Population growth", km: "កំណើនប្រជាជន" },
    "pace.assumptions.believerGrowth": { en: "Believer growth (current)", km: "កំណើនអ្នកជឿ (បច្ចុប្បន្ន)" },
    "pace.assumptions.reset": { en: "Reset to defaults", km: "កំណត់ឡើងវិញ" },
    "pace.assumptions.note": {
      en: "Population growth defaults to 1.2%/yr. Cambodia's own 2019–2024 intercensal figure was 2.1%/yr, but sustaining that for a decade is unlikely and part of it probably reflects better census coverage rather than real growth — try 2.1 to see how much harder the goal becomes. Believer growth of 8.8%/yr is Joshua Project's cited rate for Cambodia, among the fastest in Southeast Asia.",
      km: "កំណើនប្រជាជនកំណត់ដើមនៅ ១,២%/ឆ្នាំ។ តួលេខរបស់កម្ពុជាឆ្នាំ២០១៩–២០២៤ គឺ ២,១%/ឆ្នាំ ប៉ុន្តែការរក្សាអត្រានេះមួយទសវត្សរ៍គឺមិនទំនងទេ។ សូមសាកល្បង ២,១ ដើម្បីមើលថាគោលដៅកាន់តែពិបាកប៉ុណ្ណា។ កំណើនអ្នកជឿ ៨,៨%/ឆ្នាំ គឺជាអត្រាដែល Joshua Project បានលើកឡើងសម្រាប់កម្ពុជា ក្នុងចំណោមលឿនបំផុតនៅអាស៊ីអាគ្នេយ៍។",
    },

    "pace.means.title": { en: "What that actually means", km: "អ្វីដែលនោះមានន័យជាក់ស្តែង" },
    "pace.means.sub": {
      en: "A national percentage is hard to act on. These are the same number, broken down into units a province, a church and a village can work with.",
      km: "ភាគរយថ្នាក់ជាតិពិបាកនឹងអនុវត្ត។ ទាំងនេះគឺជាលេខដដែល បំបែកជាឯកតាដែលខេត្ត ក្រុមជំនុំ និងភូមិអាចធ្វើការជាមួយបាន។",
    },
    "pace.means.perYear": { en: "New believers per year", km: "អ្នកជឿថ្មីក្នុងមួយឆ្នាំ" },
    "pace.means.perYear.foot": { en: "nationally, every year until 2033", km: "ថ្នាក់ជាតិ រាល់ឆ្នាំរហូតដល់២០៣៣" },
    "pace.means.perWeek": { en: "New believers per week", km: "អ្នកជឿថ្មីក្នុងមួយសប្តាហ៍" },
    "pace.means.perWeek.foot": { en: "across all 25 provinces combined", km: "រួមទាំង ២៥ ខេត្ត" },
    "pace.means.monthly": { en: "Monthly growth needed", km: "កំណើនប្រចាំខែត្រូវការ" },
    "pace.means.monthly.foot": { en: "compounding — about 2 people per 100 each month", km: "កើនបន្តបន្ទាប់ — ប្រហែល ២ នាក់ក្នុង ១០០ រាល់ខែ" },
    "pace.means.perVillage": { en: "Believers per village at 10%", km: "អ្នកជឿក្នុងមួយភូមិនៅ ១០%" },
    "pace.means.perVillage.foot": { en: "if spread evenly across all 14,372 villages", km: "ប្រសិនបើចែកស្មើគ្នាទូទាំង ១៤,៣៧២ ភូមិ" },

    "pace.insight.multiply.title": { en: "Bigger churches alone cannot get there", km: "ក្រុមជំនុំធំជាងមុនតែម្នាក់ឯងមិនអាចទៅដល់បានទេ" },
    "pace.insight.multiply.body.a": { en: "If every church that already exists in Cambodia doubled its Sunday attendance, that would close only about", km: "ប្រសិនបើក្រុមជំនុំទាំងអស់ដែលមានស្រាប់នៅកម្ពុជាបង្កើនអ្នកចូលរួមថ្ងៃអាទិត្យទ្វេដង នោះនឹងបំពេញបានត្រឹមតែប្រហែល" },
    "pace.insight.multiply.body.b": { en: "of the gap. The rest has to come from churches that do not exist yet — roughly", km: "នៃគម្លាត។ នៅសល់ត្រូវតែមកពីក្រុមជំនុំដែលមិនទាន់មាន — ប្រហែល" },
    "pace.insight.multiply.body.c": { en: "new congregations a year. This is a church-planting goal before it is a church-growth goal.", km: "ក្រុមជំនុំថ្មីក្នុងមួយឆ្នាំ។ នេះគឺជាគោលដៅដាំក្រុមជំនុំ មុននឹងជាគោលដៅពង្រីកក្រុមជំនុំ។" },

    "pace.insight.monthly.title": { en: "Yearly targets discourage; monthly targets move", km: "គោលដៅប្រចាំឆ្នាំធ្វើឲ្យបាក់ទឹកចិត្ត គោលដៅប្រចាំខែធ្វើឲ្យរីកចម្រើន" },
    "pace.insight.monthly.body": {
      en: "The growth rate required sounds impossible stated per year, and reasonable stated per month — it is the same number. A congregation of 100 adding two people a month is exactly on pace. That is the version worth putting in front of a local leader.",
      km: "អត្រាកំណើនដែលត្រូវការស្តាប់ទៅមិនអាចទៅរួចនៅពេលនិយាយជាឆ្នាំ ប៉ុន្តែសមហេតុផលនៅពេលនិយាយជាខែ — វាគឺជាលេខដដែល។ ក្រុមជំនុំ ១០០ នាក់ដែលបន្ថែម ២ នាក់ក្នុងមួយខែ គឺស្ថិតនៅលើល្បឿនត្រឹមត្រូវ។ នោះគឺជាកំណែដែលគួរដាក់ជូនអ្នកដឹកនាំមូលដ្ឋាន។",
    },

    "pace.insight.leading.title": { en: "Watch villages, not just attendance", km: "សូមតាមដានភូមិ មិនត្រឹមតែអ្នកចូលរួម" },
    "pace.insight.leading.body": {
      en: "Attendance is a lagging number — it only moves after a church exists. The share of villages with any church at all moves first, which makes it the earlier warning signal. That is what the Village Registry is for: it turns a national percentage into a specific list of places with no church yet.",
      km: "ចំនួនអ្នកចូលរួមគឺជាលេខតាមក្រោយ — វាកើនឡើងតែបន្ទាប់ពីមានក្រុមជំនុំ។ សមាមាត្រនៃភូមិដែលមានក្រុមជំនុំកើនឡើងមុន ដែលធ្វើឲ្យវាជាសញ្ញាព្រមានមុនគេ។ នោះជាគោលបំណងនៃបញ្ជីភូមិ៖ វាបំប្លែងភាគរយថ្នាក់ជាតិទៅជាបញ្ជីជាក់លាក់នៃកន្លែងដែលមិនទាន់មានក្រុមជំនុំ។",
    },

    "pace.table.title": { en: "Year by year", km: "ម្តងមួយឆ្នាំ" },
    "pace.table.sub": {
      en: "The middle column is the one to plan against: how many people need to be gathered in churches by the end of each year to still be on pace.",
      km: "ជួរឈរកណ្តាលគឺជាអ្វីដែលត្រូវរៀបចំផែនការ៖ តើមានមនុស្សប៉ុន្មាននាក់ត្រូវប្រមូលផ្តុំក្នុងក្រុមជំនុំត្រឹមចុងឆ្នាំនីមួយៗ ដើម្បីនៅតែស្ថិតលើល្បឿនត្រឹមត្រូវ។",
    },
    "pace.table.year": { en: "Year", km: "ឆ្នាំ" },
    "pace.table.population": { en: "Cambodia's population", km: "ចំនួនប្រជាជនកម្ពុជា" },
    "pace.table.needed": { en: "Believers needed", km: "អ្នកជឿត្រូវការ" },
    "pace.table.percent": { en: "% of population", km: "% នៃប្រជាជន" },
    "pace.table.newThisYear": { en: "New that year", km: "ថ្មីក្នុងឆ្នាំនោះ" },
    "pace.table.trajectory": { en: "At current growth", km: "តាមកំណើនបច្ចុប្បន្ន" },

    "pace.province.title": { en: "Each province's share", km: "ចំណែករបស់ខេត្តនីមួយៗ" },
    "pace.province.sub": {
      en: "Every province reaching 10% of its own population. Sorted by the size of the yearly ask, so it is clear where the greatest need — and the greatest opportunity — sits.",
      km: "ខេត្តនីមួយៗឈានទៅដល់ ១០% នៃចំនួនប្រជាជនរបស់ខ្លួន។ តម្រៀបតាមទំហំនៃតម្រូវការប្រចាំឆ្នាំ ដើម្បីឲ្យច្បាស់ថាតម្រូវការធំបំផុត — និងឱកាសធំបំផុត — ស្ថិតនៅឯណា។",
    },
    "pace.province.now": { en: "Today", km: "សព្វថ្ងៃ" },
    "pace.province.target": { en: "2033 target", km: "គោលដៅ២០៣៣" },
    "pace.province.perYear": { en: "Needed per year", km: "ត្រូវការក្នុងមួយឆ្នាំ" },
    "pace.province.perWeek": { en: "Per week", km: "ក្នុងមួយសប្តាហ៍" },

    "detail.pace.title": { en: "Pace to 2033", km: "ល្បឿនទៅ២០៣៣" },
    "detail.pace.target": { en: "2033 target", km: "គោលដៅ២០៣៣" },
    "detail.pace.perYear": { en: "New believers needed per year", km: "អ្នកជឿថ្មីត្រូវការក្នុងមួយឆ្នាំ" },
    "detail.pace.perVillage": { en: "Believers per village at 10%", km: "អ្នកជឿក្នុងមួយភូមិនៅ ១០%" },
    "nav.entry": { en: "Enter Data", km: "បញ្ចូលទិន្នន័យ" },

    "hero.eyebrow": { en: "Vision · Cambodia", km: "និមិត្ត · កម្ពុជា" },
    "hero.title": { en: "10% of Cambodia following Christ by 2033", km: "១០% នៃប្រជាជនកម្ពុជាដើរតាមព្រះគ្រិស្តត្រឹមឆ្នាំ២០៣៣" },
    "hero.sub": {
      en: "Senior pastors in every province report their numbers here so the whole movement can see, together, how close we are to the goal — and where prayer and workers are needed most.",
      km: "គ្រូគង្វាលនាំមុខនៅគ្រប់ខេត្តទាំងអស់ រាយការណ៍ចំនួនរបស់ខ្លួននៅទីនេះ ដើម្បីឲ្យចលនាទាំងមូលបានឃើញជាមួយគ្នា ថាយើងខិតជិតគោលដៅប៉ុណ្ណា — និងកន្លែងណាដែលត្រូវការការអធិស្ឋាន និងកម្មករបន្ថែម។",
    },
    "hero.figures.following": { en: "Following Christ today", km: "កំពុងដើរតាមព្រះគ្រិស្តសព្វថ្ងៃ" },
    "hero.figures.people": { en: "People", km: "នាក់" },
    "hero.figures.population": { en: "Cambodia's population", km: "ចំនួនប្រជាជនកម្ពុជា" },
    "hero.figures.yearsLeft": { en: "Years to 2033", km: "ឆ្នាំទៀតដល់២០៣៣" },

    "goal.legend.confirmed": { en: "Confirmed by pastors", km: "បញ្ជាក់ដោយគ្រូគង្វាល" },
    "goal.legend.estimated": { en: "Best current estimate", km: "ការប៉ាន់ស្មានល្អបំផុតបច្ចុប្បន្ន" },
    "goal.seePace": { en: "See what this requires year by year", km: "មើលអ្វីដែលនេះទាមទារម្តងមួយឆ្នាំ" },
    "goal.methodNote": {
      en: "The lighter bar is our best estimate for the whole country; the solid bar is what pastors have actually confirmed. As reports come in, the solid bar replaces the estimate.",
      km: "របារពណ៌ស្រាលគឺជាការប៉ាន់ស្មានល្អបំផុតរបស់យើងសម្រាប់ទូទាំងប្រទេស។ របារពណ៌ដិតគឺជាអ្វីដែលគ្រូគង្វាលបានបញ្ជាក់ជាក់ស្តែង។ នៅពេលរបាយការណ៍ចូលមក របារពណ៌ដិតនឹងជំនួសការប៉ាន់ស្មាន។",
    },

    "stat.reportingProvinces.foot": { en: "have submitted a report", km: "បានដាក់ស្នើរបាយការណ៍" },

    "registry.promo.title": { en: "Track it village by village", km: "តាមដានម្តងមួយភូមិ" },
    "registry.promo.body": {
      en: "Every village in Cambodia is already listed — all 14,372 of them, from the official government gazetteer, organised by district and commune. Open your province and mark which villages have a church.",
      km: "ភូមិទាំងអស់នៅកម្ពុជាមានរាយរួចហើយ — ទាំង ១៤,៣៧២ ភូមិ ពីបញ្ជីផ្លូវការរបស់រដ្ឋាភិបាល រៀបចំតាមស្រុក និងឃុំ។ សូមបើកខេត្តរបស់អ្នក ហើយគូសសម្គាល់ភូមិណាមានក្រុមជំនុំ។",
    },
    "registry.promo.cta": { en: "Open Village Registry", km: "បើកបញ្ជីភូមិ" },
    "registry.promo.marked": { en: "villages marked so far", km: "ភូមិបានគូសសម្គាល់រហូតមកដល់ពេលនេះ" },
    "registry.picker.sub": {
      en: "Choose your province to see every district, commune and village in it — and mark where churches already exist.",
      km: "ជ្រើសរើសខេត្តរបស់អ្នក ដើម្បីមើលស្រុក ឃុំ និងភូមិទាំងអស់ក្នុងនោះ — ហើយគូសសម្គាល់កន្លែងដែលមានក្រុមជំនុំរួចហើយ។",
    },
    "registry.picker.nationwide": { en: "across all 25 provinces", km: "ទូទាំង ២៥ ខេត្ត" },
    "registry.backToPicker": { en: "All provinces", km: "ខេត្តទាំងអស់" },

    "hero.figure.reported": { en: "reported so far, of a 10% goal", km: "បានរាយការណ៍មកទល់ពេលនេះ ក្នុងគោលដៅ ១០%" },
    "hero.figure.yearsLeft": { en: "years left", km: "ឆ្នាំទៀតទេ" },
    "hero.figure.noData": { en: "No provinces have reported yet", km: "មិនទាន់មានខេត្តណារាយការណ៍នៅឡើយទេ" },
    "hero.figure.yearsLeftToGoal": { en: "years left to reach the goal", km: "ឆ្នាំទៀត ដើម្បីទៅដល់គោលដៅ" },

    "stat.reportingProvinces": { en: "Reporting Provinces", km: "ខេត្តដែលបានរាយការណ៍" },
    "stat.totalPopulation": { en: "Population Confirmed", km: "ប្រជាជនបានបញ្ជាក់" },
    "stat.totalPopulation.foot": { en: "in provinces that have reported", km: "ក្នុងខេត្តដែលបានរាយការណ៍" },
    "stat.attendance": { en: "Attendance Confirmed", km: "អ្នកចូលរួមបានបញ្ជាក់" },
    "stat.attendance.foot": { en: "counted by pastors, not estimated", km: "រាប់ដោយគ្រូគង្វាល មិនមែនប៉ាន់ស្មាន" },
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
    "detail.directoryChurches": { en: "Churches in Directory", km: "ក្រុមជំនុំក្នុងបញ្ជី" },
    "detail.directorySource": { en: "from the national church directory", km: "ពីបញ្ជីក្រុមជំនុំថ្នាក់ជាតិ" },
    "registry.directoryTitle": { en: "Churches listed in the national church directory for this commune", km: "ក្រុមជំនុំដែលមានក្នុងបញ្ជីថ្នាក់ជាតិសម្រាប់ឃុំនេះ" },
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
    "registry.fromDirectory": { en: "from directory", km: "ពីបញ្ជី" },
    "registry.fromDirectory.title": {
      en: "Pre-filled from the national church directory. Leave it if correct, untick it if that directory is wrong, or edit the church name.",
      km: "បំពេញជាមុនពីបញ្ជីក្រុមជំនុំថ្នាក់ជាតិ។ ទុកវាបើត្រឹមត្រូវ ដកសញ្ញាបើបញ្ជីនោះខុស ឬកែឈ្មោះក្រុមជំនុំ។",
    },
    "registry.pendingConfirm": { en: "to confirm", km: "ត្រូវបញ្ជាក់" },
    "registry.confirmAll": { en: "Confirm all {n} from the directory", km: "បញ្ជាក់ទាំង {n} ពីបញ្ជី" },
    "registry.confirming": { en: "Confirming…", km: "កំពុងបញ្ជាក់…" },
    "registry.directoryExplainer": {
      en: "Villages marked \u201cfrom directory\u201d were filled in automatically from the national church directory, so nobody has to re-enter what is already known. They count toward the totals, but are not treated as confirmed until a pastor accepts or corrects them.",
      km: "ភូមិដែលសម្គាល់ថា \u201cពីបញ្ជី\u201d ត្រូវបានបំពេញដោយស្វ័យប្រវត្តិពីបញ្ជីក្រុមជំនុំថ្នាក់ជាតិ ដូច្នេះគ្មាននរណាត្រូវបញ្ចូលឡើងវិញនូវអ្វីដែលដឹងរួចនោះទេ។ ពួកវារាប់បញ្ចូលក្នុងចំនួនសរុប ប៉ុន្តែមិនត្រូវបានចាត់ទុកថាបានបញ្ជាក់ទេ រហូតដល់គ្រូគង្វាលទទួលយក ឬកែតម្រូវ។",
    },
    "registry.mapsSearch": { en: "search Maps", km: "ស្វែងរកលើផែនទី" },
    "registry.mapsSearch.title": {
      en: "Open Google Maps and search for churches in this commune — useful for checking a village you are unsure about.",
      km: "បើក Google Maps ហើយស្វែងរកក្រុមជំនុំក្នុងឃុំនេះ — មានប្រយោជន៍សម្រាប់ពិនិត្យភូមិដែលអ្នកមិនប្រាកដ។",
    },
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
