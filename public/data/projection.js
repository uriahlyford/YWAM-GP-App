// Assumptions behind the "Pace to 2033" projection.
//
// These are inputs to a model, not measurements. They're all adjustable in the app so the
// team can see how sensitive the plan is to each one, rather than trusting a single number.
window.PROJECTION = {
  // Population baseline — 2024 Cambodia Inter-Censal Population Survey (NIS).
  populationBase: 17337486,
  populationBaseYear: 2024,

  // Annual population growth. Default 1.2%/yr.
  //
  // Note the tension here, because it changes the target materially: NIS measured 2.1%/yr
  // between the 2019 census and the 2024 survey, but sustaining that for another decade is
  // unlikely — Cambodia's fertility rate is falling, and part of that 2019→2024 jump probably
  // reflects improved census coverage rather than real growth. Independent demographic
  // projections sit closer to 1.0–1.2%. 1.2% is the middle; 2.1% is offered as a scenario in
  // the app because it raises the 2033 target from ~1.93M to ~2.09M people, which is not a
  // rounding error.
  populationGrowth: 0.012,
  populationGrowthAlt: 0.021,

  // Observed growth in Cambodian believers, ~8.8%/yr (Joshua Project's cited evangelical
  // growth rate for Cambodia — among the fastest in Southeast Asia).
  believerGrowth: 0.088,

  goalPercent: 10,
  goalYear: 2033,

  // For translating national targets into things a pastor can picture.
  totalVillages: 14372, // official NCDD gazetteer
  knownChurches: 1609, // ~1,544 Protestant + ~65 Catholic, per government-cited counts
};
