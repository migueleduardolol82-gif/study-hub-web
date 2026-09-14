import type { Appearance } from './avatar.ts';

const unit = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/** Cosmetic development only. Does not write measurements, rewards or account state. */
export function resolvePhysique(appearance: Appearance, physicalDays = 0) {
  const base = unit(appearance.muscle / 100);
  const progress = 1 - Math.exp(-Math.max(0, Number.isFinite(physicalDays) ? physicalDays : 0) / 60);
  const volume = base + (1 - base) * progress * 0.6;
  const softness = unit((appearance.fat - 8) / 45);
  const definition = unit(Math.pow(volume, 1.15) * (1 - softness * 0.82));
  const feminine = appearance.shape === 'feminino' ? 1 : 0;
  const masculine = appearance.shape === 'masculino' ? 1 : 0;
  return {
    volume, definition, softness, progress,
    shoulder: 0.237 + volume * 0.053 + masculine * 0.014,
    waist: 0.162 + softness * 0.074 - volume * 0.009,
    hip: 0.198 + softness * 0.035 + feminine * 0.023,
    chest: 0.217 + volume * 0.041 + masculine * 0.009,
  };
}
export type Physique = ReturnType<typeof resolvePhysique>;
