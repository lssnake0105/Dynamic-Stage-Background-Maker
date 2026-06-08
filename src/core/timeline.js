export function createTransitionState(fromScene, toScene, startedAt, durationMs) {
  return {
    fromScene,
    toScene,
    startedAt,
    durationMs
  };
}

export function getRenderState({
  scene,
  transition,
  now,
  motionEnabled,
  motionStrength
}) {
  const seconds = now / 1000;
  const transitionMix = getTransitionMix(transition, now);

  return {
    now,
    scene: transitionMix < 1 && transition.toScene ? transition.toScene : scene,
    motion: getMotionState(seconds, motionEnabled, motionStrength, scene?.settings),
    transition: {
      fromScene: transition.fromScene,
      mix: transitionMix
    }
  };
}

function getMotionState(timeSeconds, motionEnabled, motionStrength, settings = {}) {
  const cycleDuration = settings.cycleDuration || 16;
  const transitionDuration = settings.transitionDuration || 4;
  const holdDuration = cycleDuration - transitionDuration;

  if (!motionEnabled) {
    return {
      time: timeSeconds,
      motionEnabled: false,
      baseKey: "a",
      nextKey: "a",
      baseAlpha: 1,
      nextAlpha: 0,
      motionStrength
    };
  }

  const cycleIndex = Math.floor(timeSeconds / cycleDuration);
  const cycleTime = timeSeconds % cycleDuration;
  const baseKey = cycleIndex % 2 === 0 ? "a" : "b";
  const nextKey = baseKey === "a" ? "b" : "a";
  const fadeProgress =
    cycleTime <= holdDuration ? 0 : smoothstep((cycleTime - holdDuration) / transitionDuration);

  return {
    time: timeSeconds,
    motionEnabled: true,
    baseKey,
    nextKey,
    baseAlpha: 1 - fadeProgress,
    nextAlpha: fadeProgress,
    motionStrength
  };
}

function getTransitionMix(transition, now) {
  if (!transition?.toScene || !transition.durationMs) {
    return 1;
  }
  const elapsed = now - transition.startedAt;
  if (elapsed >= transition.durationMs) {
    return 1;
  }
  return smoothstep(elapsed / transition.durationMs);
}

function smoothstep(value) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}
