// Starting estimates for provinces that have not yet been confirmed by a pastor.
//
// These are NOT authoritative province-level data — that mostly doesn't exist publicly for
// Cambodia. They exist so the dashboard shows *something* plausible instead of a blank dash
// before any province has reported, and so pastors have a number to react to (confirm, correct,
// or replace) rather than starting from zero. Every entry is clearly labeled "Estimated" in the
// UI, distinct from "Confirmed" (pastor-submitted) data, and is replaced automatically the
// moment a real report comes in for that province.
//
// Methodology, compiled from a multi-source research pass (national statistics, Joshua Project,
// World Religion Database, EFC/OMF/mission estimates, Cambodia's 2008/2019 census religion-by-
// province tables, and ethnic-minority concentration data):
//
// - National baseline (2.0%): independent research bodies (Joshua Project ~3.3%, World Religion
//   Database ~2.8%, EFC/OMF/mission estimates ~1.5-2.9%) cluster well above Cambodia's own 2024
//   government census figure of 0.3% — a gap researchers attribute to under-reporting, since
//   Khmer ethnic identity is culturally fused with Buddhism. Cross-checking known church/believer
//   counts (~1,600 churches, ~250,000-330,000 believers) against total population lands close to
//   2.0%, so that's the baseline applied to every province without a specific reason to differ.
// - Mondulkiri and Ratanakiri are the one clear exception: both the 2019 government census
//   (4.0% and 2.1% respectively) AND independent research on Christian conversion among
//   indigenous highland peoples (Bunong/Phnong, Jarai, Tampuan, Kreung and others) agree these
//   two provinces are meaningfully above the national average. Two independent methods pointing
//   the same direction is why these two (and only these two) get a distinct number.
// - Every other province's number is the flat national baseline — not because nothing is
//   happening there, but because no publicly available source gave a defensible province-specific
//   percentage. A few provinces have real qualitative history (noted below) that didn't rise to
//   the level of a citable number.
window.SEED_ESTIMATES = {
  "banteay-meanchey": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "battambang": { percentChristian: 2.0, confidence: "national-average", note: "Historic center of Cambodian Protestant Christianity (Bible Institute of Battambang, founded 1925; churches planted here by the 1950s) — but no province-specific percentage is published, so the national average is applied.", source: "National average estimate; historical note from mission-history sources" },
  "kampong-cham": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied. Also has a large Cham Muslim population, which may lower the Christian share somewhat.", source: "National average estimate" },
  "kampong-chhnang": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "kampong-speu": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "kampong-thom": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "kampot": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied. Also has a notable Muslim population, which may lower the Christian share somewhat.", source: "National average estimate" },
  "kandal": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "kep": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "koh-kong": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "kratie": { percentChristian: 2.0, confidence: "national-average", note: "Small indigenous Kraol community here has a notably high Christian percentage, but is too small a share of the province's total population to move the province-wide number; national average applied.", source: "National average estimate" },
  "mondulkiri": { percentChristian: 4.0, confidence: "province-signal", note: "Cambodia's highest — 2019 government census reports 4.0% Christian, corroborated independently by research on Christian conversion among the Bunong/Phnong indigenous majority (some communes reportedly far higher, e.g. Bousra).", source: "2019 Cambodia General Population Census (NIS), cross-checked against ethnic-minority mission research" },
  "oddar-meanchey": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "pailin": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "phnom-penh": { percentChristian: 2.0, confidence: "national-average", note: "The capital hosts the national Catholic vicariate (~12,000 Catholics) and the Evangelical Fellowship of Cambodia's headquarters, but no province-specific percentage is published, so the national average is applied.", source: "National average estimate; institutional-presence note" },
  "preah-sihanouk": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "preah-vihear": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "prey-veng": { percentChristian: 2.0, confidence: "national-average", note: "Home to Neak Loeung, Cambodia's oldest Catholic community (founded 1863, Vietnamese-origin) — but this doesn't move the province-wide percentage much, so the national average is applied.", source: "National average estimate; historical note" },
  "pursat": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "ratanakiri": { percentChristian: 2.1, confidence: "province-signal", note: "2019 government census reports 2.1% Christian, corroborated independently by research on Christian conversion among Jarai, Tampuan, Kreung, Brao and other indigenous highland peoples (churches reported in roughly 20 of 48 Jarai villages).", source: "2019 Cambodia General Population Census (NIS), cross-checked against ethnic-minority mission research" },
  "siem-reap": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "stung-treng": { percentChristian: 2.0, confidence: "national-average", note: "Small indigenous communities here (Kavet, Brao) have some Christian presence, but too small a share of the province's total population to move the province-wide number; national average applied.", source: "National average estimate" },
  "svay-rieng": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "takeo": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied.", source: "National average estimate" },
  "tboung-khmum": { percentChristian: 2.0, confidence: "national-average", note: "No province-specific data found; national average applied. Also has one of Cambodia's largest Cham Muslim populations, which may lower the Christian share somewhat.", source: "National average estimate" },
};

window.NATIONAL_ESTIMATE = {
  percentChristian: 2.0,
  governmentPercent: 0.3,
  asOfYear: 2024,
  source: "Independent synthesis (Joshua Project, World Religion Database, EFC/OMF/mission estimates, cross-checked against known church and believer counts), vs. Cambodia's own 2024 government census figure of 0.3% (Inter-Censal Population Survey, NIS) — a gap most researchers attribute to under-reporting",
};
