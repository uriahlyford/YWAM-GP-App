// The 25 first-level administrative divisions of Cambodia (24 provinces + Phnom Penh capital).
//
// referencePopulation: 2024 Cambodia Inter-Censal Population Survey
//   (National Institute of Statistics, Ministry of Planning).
// referenceVillages / referenceCommunes / referenceDistricts: counted directly from the
//   official NCDD commune/village gazetteer (db.ncdd.gov.kh/gazetteer), via the open-source
//   extraction at github.com/RathanakSreang/cambodia-gazetteer (MIT licensed).
//
// All reference figures are a starting point, not the final word — provincial leaders should
// confirm and update them with their own local knowledge. Administrative boundaries and
// population both shift over time.
window.PROVINCES = [
  { id: "banteay-meanchey", name: "Banteay Meanchey", nameKhmer: "បន្ទាយមានជ័យ", referencePopulation: 898484, referenceVillages: 652, referenceCommunes: 65, referenceDistricts: 9 },
  { id: "battambang", name: "Battambang", nameKhmer: "បាត់ដំបង", referencePopulation: 1132017, referenceVillages: 810, referenceCommunes: 102, referenceDistricts: 14 },
  { id: "kampong-cham", name: "Kampong Cham", nameKhmer: "កំពង់ចាម", referencePopulation: 1062914, referenceVillages: 916, referenceCommunes: 109, referenceDistricts: 10 },
  { id: "kampong-chhnang", name: "Kampong Chhnang", nameKhmer: "កំពង់ឆ្នាំង", referencePopulation: 604895, referenceVillages: 569, referenceCommunes: 70, referenceDistricts: 8 },
  { id: "kampong-speu", name: "Kampong Speu", nameKhmer: "កំពង់ស្ពឺ", referencePopulation: 924175, referenceVillages: 1363, referenceCommunes: 87, referenceDistricts: 8 },
  { id: "kampong-thom", name: "Kampong Thom", nameKhmer: "កំពង់ធំ", referencePopulation: 807254, referenceVillages: 765, referenceCommunes: 81, referenceDistricts: 8 },
  { id: "kampot", name: "Kampot", nameKhmer: "កំពត", referencePopulation: 682987, referenceVillages: 488, referenceCommunes: 93, referenceDistricts: 8 },
  { id: "kandal", name: "Kandal", nameKhmer: "កណ្ដាល", referencePopulation: 1352198, referenceVillages: 1010, referenceCommunes: 127, referenceDistricts: 11 },
  { id: "kep", name: "Kep", nameKhmer: "កែប", referencePopulation: 48772, referenceVillages: 18, referenceCommunes: 5, referenceDistricts: 2 },
  { id: "koh-kong", name: "Koh Kong", nameKhmer: "កោះកុង", referencePopulation: 140962, referenceVillages: 119, referenceCommunes: 29, referenceDistricts: 7 },
  { id: "kratie", name: "Kratié", nameKhmer: "ក្រចេះ", referencePopulation: 441078, referenceVillages: 258, referenceCommunes: 47, referenceDistricts: 6 },
  { id: "mondulkiri", name: "Mondulkiri", nameKhmer: "មណ្ឌលគិរី", referencePopulation: 97857, referenceVillages: 92, referenceCommunes: 21, referenceDistricts: 5 },
  { id: "oddar-meanchey", name: "Oddar Meanchey", nameKhmer: "ឧត្ដរមានជ័យ", referencePopulation: 267203, referenceVillages: 304, referenceCommunes: 24, referenceDistricts: 5 },
  { id: "pailin", name: "Pailin", nameKhmer: "ប៉ៃលិន", referencePopulation: 79445, referenceVillages: 90, referenceCommunes: 8, referenceDistricts: 2 },
  { id: "phnom-penh", name: "Phnom Penh", nameKhmer: "រាជធានីភ្នំពេញ", referencePopulation: 2352851, referenceVillages: 953, referenceCommunes: 105, referenceDistricts: 12 },
  { id: "preah-sihanouk", name: "Preah Sihanouk (Sihanoukville)", nameKhmer: "ព្រះសីហនុ", referencePopulation: 234702, referenceVillages: 111, referenceCommunes: 29, referenceDistricts: 4 },
  { id: "preah-vihear", name: "Preah Vihear", nameKhmer: "ព្រះវិហារ", referencePopulation: 249973, referenceVillages: 232, referenceCommunes: 51, referenceDistricts: 8 },
  { id: "prey-veng", name: "Prey Veng", nameKhmer: "ព្រៃវែង", referencePopulation: 1331111, referenceVillages: 1149, referenceCommunes: 116, referenceDistricts: 13 },
  { id: "pursat", name: "Pursat", nameKhmer: "ពោធិ៍សាត់", referencePopulation: 516071, referenceVillages: 511, referenceCommunes: 49, referenceDistricts: 6 },
  { id: "ratanakiri", name: "Ratanakiri", nameKhmer: "រតនគិរី", referencePopulation: 235852, referenceVillages: 243, referenceCommunes: 50, referenceDistricts: 9 },
  { id: "siem-reap", name: "Siem Reap", nameKhmer: "សៀមរាប", referencePopulation: 1099825, referenceVillages: 909, referenceCommunes: 100, referenceDistricts: 12 },
  { id: "stung-treng", name: "Stung Treng", nameKhmer: "ស្ទឹងត្រែង", referencePopulation: 176488, referenceVillages: 128, referenceCommunes: 34, referenceDistricts: 5 },
  { id: "svay-rieng", name: "Svay Rieng", nameKhmer: "ស្វាយរៀង", referencePopulation: 613159, referenceVillages: 690, referenceCommunes: 80, referenceDistricts: 8 },
  { id: "takeo", name: "Takéo", nameKhmer: "តាកែវ", referencePopulation: 1097243, referenceVillages: 1119, referenceCommunes: 100, referenceDistricts: 10 },
  { id: "tboung-khmum", name: "Tboung Khmum", nameKhmer: "ត្បូងឃ្មុំ", referencePopulation: 889970, referenceVillages: 873, referenceCommunes: 64, referenceDistricts: 7 },
];

window.POPULATION_SOURCE = {
  label: "2024 Cambodia Inter-Censal Population Survey",
  publisher: "National Institute of Statistics, Ministry of Planning",
};

window.VILLAGE_SOURCE = {
  label: "Official NCDD commune/village gazetteer",
  publisher: "National Committee for Sub-National Democratic Development",
};

// National goal: 10% of the population following Christ by Jan 1, 2033.
window.GOAL = {
  targetPercent: 10,
  targetDate: "2033-01-01",
};
