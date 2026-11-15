import { createMission } from './mission.js';

/**
 * Build a playable chapter through the ordinary mission commands and physics.
 * No checkpoint fuel, orbit or consumables are guessed: the Mars chapter is the
 * nominal mission at MOI cutoff. The ~259-day Hohmann coast uses its exact
 * duration (transfer.js), and life support also includes ascent and both burns.
 *
 * @param {'launch' | 'transfer' | 'mars-orbit'} chapter
 * @returns {ReturnType<typeof createMission>}
 */
export function createScenario(chapter) {
  if (!['launch', 'transfer', 'mars-orbit'].includes(chapter)) throw new RangeError(`Unknown mission chapter: ${chapter}`);
  const mission = createMission();
  if (chapter === 'launch') return mission;

  mission.launch();
  // Match the mission's 50 Hz integration; only the analytical cruise is batched.
  // GAME ASSUMPTION: execution guard, not an elapsed-time phase transition.
  for (let tick = 0; tick < 300000; tick++) {
    if (mission.state.phase === (chapter === 'transfer' ? 'CRUISE' : 'MARS_ORBIT')) return mission;
    if (mission.state.phase === 'FAILED') break;
    if (mission.state.phase === 'PARKING_ORBIT') mission.burn();
    if (mission.state.phase === 'CRUISE') {
      const remaining = mission.state.transfer.duration - mission.state.cruiseTime;
      if (mission.advanceCoast(remaining) > 0) continue;
    }
    mission.step(.02);
  }
  throw new Error(`Nominal mission did not reach the requested chapter: ${mission.state.failureReason ?? mission.state.phase}`);
}
