// The 25 first-level administrative divisions of Cambodia (24 provinces + Phnom Penh capital).
// referencePopulation figures are from the 2024 Cambodia Inter-Censal Population Survey
// (National Institute of Statistics, Ministry of Planning) — the most recent official
// government population count at the time this app was built. They're provided as a
// starting reference only: provincial leaders should confirm and update them with their
// own local knowledge, since real population shifts year to year.
window.PROVINCES = [
  { id: "banteay-meanchey", name: "Banteay Meanchey", referencePopulation: 898484 },
  { id: "battambang", name: "Battambang", referencePopulation: 1132017 },
  { id: "kampong-cham", name: "Kampong Cham", referencePopulation: 1062914 },
  { id: "kampong-chhnang", name: "Kampong Chhnang", referencePopulation: 604895 },
  { id: "kampong-speu", name: "Kampong Speu", referencePopulation: 924175 },
  { id: "kampong-thom", name: "Kampong Thom", referencePopulation: 807254 },
  { id: "kampot", name: "Kampot", referencePopulation: 682987 },
  { id: "kandal", name: "Kandal", referencePopulation: 1352198 },
  { id: "kep", name: "Kep", referencePopulation: 48772 },
  { id: "koh-kong", name: "Koh Kong", referencePopulation: 140962 },
  { id: "kratie", name: "Kratié", referencePopulation: 441078 },
  { id: "mondulkiri", name: "Mondulkiri", referencePopulation: 97857 },
  { id: "oddar-meanchey", name: "Oddar Meanchey", referencePopulation: 267203 },
  { id: "pailin", name: "Pailin", referencePopulation: 79445 },
  { id: "phnom-penh", name: "Phnom Penh", referencePopulation: 2352851 },
  { id: "preah-sihanouk", name: "Preah Sihanouk (Sihanoukville)", referencePopulation: 234702 },
  { id: "preah-vihear", name: "Preah Vihear", referencePopulation: 249973 },
  { id: "prey-veng", name: "Prey Veng", referencePopulation: 1331111 },
  { id: "pursat", name: "Pursat", referencePopulation: 516071 },
  { id: "ratanakiri", name: "Ratanakiri", referencePopulation: 235852 },
  { id: "siem-reap", name: "Siem Reap", referencePopulation: 1099825 },
  { id: "stung-treng", name: "Stung Treng", referencePopulation: 176488 },
  { id: "svay-rieng", name: "Svay Rieng", referencePopulation: 613159 },
  { id: "takeo", name: "Takéo", referencePopulation: 1097243 },
  { id: "tboung-khmum", name: "Tboung Khmum", referencePopulation: 889970 },
];

window.POPULATION_SOURCE = {
  label: "2024 Cambodia Inter-Censal Population Survey",
  publisher: "National Institute of Statistics, Ministry of Planning",
};

// National goal: 10% of the population following Christ by Jan 1, 2033.
window.GOAL = {
  targetPercent: 10,
  targetDate: "2033-01-01",
};
