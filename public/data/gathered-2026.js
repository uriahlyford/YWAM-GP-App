// Gathered — 2026 national committee roster.
//
// Imported once from "List of Christian in Cambodia 2026" (បញ្ជីរាយនាមគណៈកម្មការគ្រិស្តបរិស័ទ
// ទូទាំងប្រទេស ប្រចាំឆ្នាំ២០២៦"), a spreadsheet listing each province's Christian committee
// members alongside a province-wide roll-up: total committee leaders, total church members,
// and members split into children and adults. Phnom Penh has no provincial committee — it
// reports through five denominations instead, so its figures are a sum across those.
//
// This sits alongside the leader's own Submit estimate as a second, independent count.
// The two are never blended: see the Total screen's Estimated-vs-Gathered comparison.
// A missing figure below (tboung-khmum) means the source spreadsheet's roll-up row for
// that province was left blank, not that it was zero.
window.GATHERED_2026 = {
  source: {
    label: "2026 national Christian committee roster",
    labelKhmer: "បញ្ជីរាយនាមគណៈកម្មការគ្រិស្តបរិស័ទទូទាំងប្រទេស ប្រចាំឆ្នាំ២០២៦",
  },
  byProvince: {
    "kratie": { leaders: 79, members: 3243, children: 1222, adults: 2021 },
    "kampong-cham": { leaders: 107, members: 21500, children: 12000, adults: 9500 },
    "kampong-thom": { leaders: 316, members: 28738, children: 12270, adults: 16468 },
    "kampot": { leaders: 107, members: 18843, children: null, adults: 18843 },
    "takeo": { leaders: 253, members: 36612, children: 16579, adults: 20033 },
    "banteay-meanchey": { leaders: 240, members: 13625, children: 1044, adults: 12581 },
    "pailin": { leaders: 25, members: 1988, children: 1034, adults: 954 },
    "battambang": { leaders: 250, members: 19843, children: 10798, adults: 9045 },
    "preah-vihear": { leaders: 77, members: 3341, children: null, adults: 3341 },
    "mondulkiri": { leaders: 32, members: 7659, children: 1156, adults: 6503 },
    "ratanakiri": { leaders: 176, members: 7956, children: 1247, adults: 6709 },
    "siem-reap": { leaders: 196, members: 3439, children: null, adults: 3439 },
    "stung-treng": { leaders: 77, members: 3475, children: null, adults: 3475 },
    "pursat": { leaders: 55, members: 4795, children: 1439, adults: 3356 },
    "koh-kong": { leaders: 57, members: 5987, children: 1070, adults: 4917 },
    "kampong-speu": { leaders: 106, members: 7362, children: 976, adults: 6386 },
    "oddar-meanchey": { leaders: 126, members: 3539, children: null, adults: 3539 },
    "kandal": { leaders: 212, members: 7146, children: 1370, adults: 5776 },
    "preah-sihanouk": { leaders: 59, members: 5971, children: null, adults: 5971 },
    "tboung-khmum": null,
    "prey-veng": { leaders: 85, members: 3914, children: null, adults: 3914 },
    "svay-rieng": { leaders: 127, members: 6309, children: 968, adults: 5341 },
    "kampong-chhnang": { leaders: 186, members: 7580, children: 1200, adults: 6380 },
    "kep": { leaders: 15, members: 572, children: 254, adults: 318 },

    // Reported through 5 denominations rather than a province committee; `leaders` here
    // is the sum of each denomination's church count, not individual leaders.
    "phnom-penh": {
      leaders: 567,
      members: 26034,
      children: null,
      adults: null,
      denominations: [
        { nameKhmer: "និកាយប្រេសបៃទែរៀនខ្មែរ", name: "Khmer Presbyterian denomination", churches: 18, members: 1500 },
        { nameKhmer: "និកាយមេតូឌីសកម្ពុជា", name: "Methodist Church of Cambodia", churches: 124, members: 2713 },
        { nameKhmer: "ក្រុមជំនុំក្តីសង្ឃឹមរស់ក្នុងព្រះគ្រីស្ទ", name: "Living Hope in Christ congregations", churches: 122, members: 3274 },
        { nameKhmer: "ស៊ីអិមអេកម្ពុជា", name: "C&MA Cambodia", churches: 205, members: 7889 },
        { nameKhmer: "និកាយអង់គ្លីខានកម្ពុជា", name: "Anglican Church of Cambodia", churches: 8, members: 365 },
        { nameKhmer: "និកាយសហព័ន្ធបាបទីស្ទកម្ពុជា", name: "Baptist Federation of Cambodia", churches: 90, members: 10293 },
      ],
    },
  },
};
