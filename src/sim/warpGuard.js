// Steps-per-frame guard for time warp. Physics is fixed-timestep, so results do not depend on warp;
// this only bounds work per rendered frame: atmosphere ≤ ×50, powered flight in vacuum ≤ ×1000,
// coasting (analytic propagation) unrestricted.
export const warpWithinGuard = (warp, state) =>
  state.inAtmosphere !== false ? warp <= 50 : state.engineFiring !== false ? warp <= 1000 : true;
