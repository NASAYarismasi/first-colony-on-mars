/** ?han source adapter (a7d5ce6): assets use Vite URLs, never embedded scripts. */
export const modelUrl = name => import.meta.env.BASE_URL + 'models/colony/' + name;
export function loadCraterAssets() {
  return { rover:modelUrl('perseverance.glb'), suit:modelUrl('team-astronaut.glb'), regolith:modelUrl('three-forks-regolith.jpg') };
}
