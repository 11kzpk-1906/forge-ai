
type ParticleFieldProps = {
  className?: string;
  particleCount?: number;
  particleColors?: string[];
  particleSpread?: number;
  speed?: number;
  moveParticlesOnHover?: boolean;
  particleHoverFactor?: number;
  disableRotation?: boolean;
  particleBaseSize?: number;
  sizeRandomness?: number;
  alphaParticles?: boolean;
  cameraDistance?: number;
  pixelRatio?: number;
};

export function ParticleField({ className = "" }: ParticleFieldProps) {
  const fallbackParticles = Array.from({ length: 42 }, (_, index) => ({
    left: (index * 37) % 101,
    top: 8 + ((index * 61) % 84),
    size: 2 + (index % 4),
    delay: -((index * 0.47) % 8),
    duration: 7 + (index % 6),
    drift: -12 + ((index * 17) % 25),
  }));

  return (
    <div
      className={`particle-field ${className}`}
      aria-hidden="true"
    >
      <div className="particle-fallback-layer">
        {fallbackParticles.map((particle, index) => (
          <span
            className="particle-fallback"
            key={index}
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
              ["--particle-drift" as string]: `${particle.drift}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
