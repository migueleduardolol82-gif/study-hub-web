import { ParticleWave } from "@/components/ui/particle-wave";

function ParticleWaveDemo() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <ParticleWave className="absolute inset-0 h-full w-full" />
      <p className="relative z-10 p-4 text-sm text-white">Particle Wave Animation</p>
    </div>
  );
}

export { ParticleWaveDemo };
