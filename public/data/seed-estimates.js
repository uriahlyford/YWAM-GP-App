// Starting estimates for provinces that have not yet been confirmed by a pastor.
//
// These are NOT authoritative province-level measurements. They exist so the dashboard shows
// something plausible and differentiated before any province has reported, and so pastors have
// a real number to react to (confirm, correct, or replace) rather than starting from zero.
// Every entry is badged "Estimated" in the UI, distinct from "Confirmed" (pastor-submitted),
// and is replaced permanently the moment a real report arrives for that province.
//
// ---------------------------------------------------------------------------------------
// METHODOLOGY
// ---------------------------------------------------------------------------------------
// Two facts drive this, both established in a multi-source research pass:
//
// 1. Cambodia's own census religion question reports 0.3% Christian nationally (CIPS 2024),
//    while independent research bodies (Joshua Project ~3.3%, World Religion Database ~2.8%,
//    EFC/OMF/mission estimates ~1.5-2.9%) cluster far higher. Cross-checking known church and
//    believer counts (~1,600 churches, ~250,000-330,000 believers) against total population
//    supports roughly 2.0%. The gap is attributed to under-reporting: Khmer ethnic identity is
//    culturally fused with Buddhism, so declaring "Christian" on a government form carries
//    real social cost.
//
// 2. The census undercounts, but it is the SAME instrument applied in every province, so its
//    *relative* pattern across provinces is still informative even though its absolute level
//    is too low.
//
// So each province's estimate is:
//
//       estimate% = censusPrior% + offset
//
//   where offset = (2.0% national target − population-weighted census prior) = +1.671 points.
//   That offset represents ~289,700 believers the census misses, distributed proportional to
//   population. The result reproduces the 2.0% national figure to within 0.001 points.
//
// Why ADDITIVE rather than multiplicative: the undercount mechanism is social pressure on a
// government form, which is approximately a per-capita effect — not one proportional to how
// many Christians a province already has. Scaling multiplicatively (6.7x) would put Mondulkiri
// at ~27%, which is plainly wrong. The additive model preserves the census's ordering without
// exploding the outliers.
//
// KNOWN LIMITATIONS, stated plainly:
//   - Distributing the uncounted by raw population is a neutral assumption, not a measured one.
//     The undercount is probably heavier in Khmer-majority lowland provinces (more social
//     pressure) and in cities (unregistered house churches) — but no data exists to weight it,
//     so it is spread evenly.
//   - This compresses the lowland provinces into a narrow 1.77%-2.07% band. That is the honest
//     output: the census puts them all within 0.1-0.4% of each other, and inventing more spread
//     than the source data contains would be fabrication.
//   - `tier` on each entry records exactly how solid that province's prior is. Read it before
//     trusting any single number.
// ---------------------------------------------------------------------------------------
//
// tier values:
//   "census-2019"      - census figure explicitly attributed to the 2019 column
//   "census-clean"     - census figure read consistently across both 2008 and 2019 columns
//   "census-ambiguous" - census figure read, but 2008-vs-2019 column attribution uncertain
//   "census-residual"  - Christian cell unreadable; derived from published Buddhist/Muslim shares
//   "inferred"         - no census reading; inferred from documented institutional/ethnic evidence
//   "default"          - no province signal of any kind; national census average used as prior
window.SEED_ESTIMATES = {
  "mondulkiri": { percentChristian: 5.67, censusPrior: 4.0, tier: "census-2019", confidence: "high", note: "Cambodia's highest. The 2019 government census reports 4.0% Christian here — over 13x the national census average — corroborated independently by research on Christian conversion among the Bunong/Phnong indigenous majority. Some communes are reported far higher (e.g. Bousra).", source: "2019 Cambodia General Population Census (NIS), cross-checked against indigenous-minority mission research" },
  "ratanakiri": { percentChristian: 3.77, censusPrior: 2.1, tier: "census-2019", confidence: "high", note: "The 2019 government census reports 2.1% Christian, corroborated independently by research on conversion among the Jarai, Tampuan, Kreung and Brao peoples — churches are reported in roughly 20 of 48 Jarai villages.", source: "2019 Cambodia General Population Census (NIS), cross-checked against indigenous-minority mission research" },
  "phnom-penh": { percentChristian: 2.27, censusPrior: 0.6, tier: "inferred", confidence: "low", note: "No census reading was obtainable for the capital. The prior is inferred from institutional presence: the Catholic Apostolic Vicariate alone reports ~12,000 Catholics here, plus the Evangelical Fellowship of Cambodia's headquarters and a concentration of urban house churches. Treat as the softest number in this table.", source: "Inferred from Catholic vicariate statistics and documented institutional presence" },
  "stung-treng": { percentChristian: 2.17, censusPrior: 0.5, tier: "inferred", confidence: "low", note: "No census reading was obtainable. The prior is inferred from documented Kavet and Brao indigenous Christian communities, concentrated in Siem Pang district. Small absolute numbers.", source: "Inferred from indigenous-minority mission research" },
  "kandal": { percentChristian: 2.07, censusPrior: 0.4, tier: "census-ambiguous", confidence: "medium", note: "Census figure of 0.4% Christian was read, but the 2008-vs-2019 column attribution could not be confirmed. Surrounds Phnom Penh, so likely benefits from capital spillover.", source: "Cambodia General Population Census (NIS), year attribution unconfirmed" },
  "siem-reap": { percentChristian: 2.07, censusPrior: 0.4, tier: "census-clean", confidence: "medium", note: "The census reports 0.4% Christian, above the national census average. Large urban, NGO and expatriate presence alongside the Khmer population.", source: "2019 Cambodia General Population Census (NIS)" },
  "battambang": { percentChristian: 1.97, censusPrior: 0.3, tier: "census-clean", confidence: "medium", note: "The census reports 0.3% Christian. Historically the deepest Protestant institutional roots in Cambodia — the Bible Institute of Battambang was founded here in 1925 — and seat of a Catholic Apostolic Prefecture.", source: "2019 Cambodia General Population Census (NIS)" },
  "kampong-chhnang": { percentChristian: 1.97, censusPrior: 0.3, tier: "census-clean", confidence: "medium", note: "The census reports 0.3% Christian.", source: "2019 Cambodia General Population Census (NIS)" },
  "kampong-thom": { percentChristian: 1.97, censusPrior: 0.3, tier: "census-ambiguous", confidence: "medium", note: "Census figure of 0.3% Christian was read, but the 2008-vs-2019 column attribution could not be confirmed. Some Kuy indigenous presence.", source: "Cambodia General Population Census (NIS), year attribution unconfirmed" },
  "preah-vihear": { percentChristian: 1.97, censusPrior: 0.3, tier: "census-residual", confidence: "low", note: "The Christian cell was not readable; the prior is derived from the published Buddhist share (99.1%). Kuy and Pear indigenous communities are present.", source: "Derived from 2019 Cambodia General Population Census (NIS) published religion shares" },
  "kep": { percentChristian: 1.97, censusPrior: 0.3, tier: "default", confidence: "low", note: "No province-specific signal of any kind was found. The national census average is used as the prior. Cambodia's smallest province by population.", source: "National census average (no province data available)" },
  "koh-kong": { percentChristian: 1.97, censusPrior: 0.3, tier: "default", confidence: "low", note: "No province-specific signal of any kind was found. The national census average is used as the prior. Small Pearic (Chong/Por) communities are present but are primarily animist.", source: "National census average (no province data available)" },
  "oddar-meanchey": { percentChristian: 1.97, censusPrior: 0.3, tier: "default", confidence: "low", note: "No province-specific signal of any kind was found. The national census average is used as the prior.", source: "National census average (no province data available)" },
  "pailin": { percentChristian: 1.97, censusPrior: 0.3, tier: "default", confidence: "low", note: "No province-specific signal of any kind was found. The national census average is used as the prior.", source: "National census average (no province data available)" },
  "banteay-meanchey": { percentChristian: 1.87, censusPrior: 0.2, tier: "census-clean", confidence: "medium", note: "The census reports 0.2% Christian, slightly below the national census average.", source: "2019 Cambodia General Population Census (NIS)" },
  "kampot": { percentChristian: 1.87, censusPrior: 0.2, tier: "census-ambiguous", confidence: "medium", note: "Census figure of 0.2% Christian was read, but the 2008-vs-2019 column attribution could not be confirmed. Also has a sizeable Cham Muslim population.", source: "Cambodia General Population Census (NIS), year attribution unconfirmed" },
  "kratie": { percentChristian: 1.87, censusPrior: 0.2, tier: "census-2019", confidence: "medium", note: "The census reports 0.2% Christian. The small indigenous Kraol community here has a notably high Christian share, but is too small a fraction of the province to move the province-wide figure.", source: "2019 Cambodia General Population Census (NIS)" },
  "preah-sihanouk": { percentChristian: 1.87, censusPrior: 0.2, tier: "census-clean", confidence: "medium", note: "The census reports 0.2% Christian in 2019 (the 2008 column showed 0.7%, so this province's figure moved between censuses).", source: "2019 Cambodia General Population Census (NIS)" },
  "prey-veng": { percentChristian: 1.87, censusPrior: 0.2, tier: "census-residual", confidence: "low", note: "The Christian cell was not readable; the prior is derived from the published Buddhist share (over 99.5%). Home to Neak Loeung, Cambodia's oldest Catholic community, founded 1863.", source: "Derived from 2019 Cambodia General Population Census (NIS) published religion shares" },
  "takeo": { percentChristian: 1.87, censusPrior: 0.2, tier: "census-residual", confidence: "low", note: "The Christian cell was not readable; the prior is derived from the published Buddhist (99.2%) and Muslim (0.6%) shares.", source: "Derived from 2019 Cambodia General Population Census (NIS) published religion shares" },
  "kampong-cham": { percentChristian: 1.77, censusPrior: 0.1, tier: "census-clean", confidence: "medium", note: "The census reports 0.1% Christian, among the lowest in the country — despite being one of the first provinces evangelised (churches by the 1950s) and the seat of a Catholic Apostolic Prefecture. Also has a large Cham Muslim population.", source: "2019 Cambodia General Population Census (NIS)" },
  "kampong-speu": { percentChristian: 1.77, censusPrior: 0.1, tier: "census-clean", confidence: "medium", note: "The census reports 0.1% Christian, among the lowest in the country.", source: "2019 Cambodia General Population Census (NIS)" },
  "pursat": { percentChristian: 1.77, censusPrior: 0.1, tier: "census-2019", confidence: "medium", note: "The census reports 0.1% Christian. A Vietnamese-speaking Catholic floating church exists at Kampong Luong.", source: "2019 Cambodia General Population Census (NIS)" },
  "svay-rieng": { percentChristian: 1.77, censusPrior: 0.1, tier: "census-2019", confidence: "medium", note: "The census reports 0.1% Christian, among the lowest in the country.", source: "2019 Cambodia General Population Census (NIS)" },
  "tboung-khmum": { percentChristian: 1.77, censusPrior: 0.1, tier: "census-2019", confidence: "medium", note: "The census reports 0.1% Christian. Has one of Cambodia's largest Cham Muslim populations (around 11-12%), which lowers the Christian share. Small Stieng indigenous Christian communities exist around Memot.", source: "2019 Cambodia General Population Census (NIS)" },
};

window.NATIONAL_ESTIMATE = {
  percentChristian: 2.0,
  governmentPercent: 0.3,
  asOfYear: 2024,
  source: "Independent synthesis (Joshua Project, World Religion Database, EFC/OMF/mission estimates, cross-checked against known church and believer counts), vs. Cambodia's own 2024 government census figure of 0.3% (Inter-Censal Population Survey, NIS) — a gap most researchers attribute to under-reporting",
};

// How the per-province numbers were derived — surfaced in the UI so the method is never hidden.
window.ESTIMATE_METHOD = {
  offsetPoints: 1.671,
  censusNationalPercent: 0.33,
  uncountedBelievers: 289706,
};
