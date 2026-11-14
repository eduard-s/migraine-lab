import { DURATION, episodePhase, isAuraActive, STEP, type EpisodeComparison, type Sample } from '../core/index.js'

export const HEAD_PAIN_SETTLED = 0.025

export function treatmentTargetTime(exposure: number, engagement: number) {
  return exposure + engagement * 1.25
}

export function nerveStrength(sample: Sample) {
  const activity = sample.releasedCgrp * 0.2 + sample.freeCgrp * 0.38 + sample.freePacap * 0.17
  return Math.min(1, activity)
}

export function sampleBetween(samples: readonly Sample[], time: number): Sample {
  const position = Math.max(0, Math.min(samples.length - 1, time / STEP))
  const index = Math.floor(position)
  const first = samples[index]
  const next = samples[Math.min(index + 1, samples.length - 1)]
  const mix = position - index
  if (!mix) return first
  const sample = { ...first }
  for (const key of Object.keys(sample) as (keyof Sample)[]) {
    sample[key] += (next[key] - first[key]) * mix
  }
  return sample
}

export function workbenchDuration(episode: EpisodeComparison) {
  if (episode.triggerInput * 100 <= episode.factors.threshold) return DURATION

  const recoveryEnd = episode.baseline.find(sample => sample.time >= episode.lastRelease && !isAuraActive(sample) && episodePhase(episode, sample) === 'Settled')
  return recoveryEnd?.time ?? DURATION
}

export function painSettledAt(samples: readonly Sample[], lastRelease: number) {
  let settlingTime: number | undefined
  for (const sample of samples) {
    if (sample.time < lastRelease) continue
    if (sample.headache > HEAD_PAIN_SETTLED) settlingTime = undefined
    else settlingTime ??= sample.time
  }
  return settlingTime
}

export function workbenchTraces(episode: EpisodeComparison) {
  const nerve = episode.baseline.map(nerveStrength)
  const nervePeak = Math.max(...nerve)
  const settledAt = painSettledAt(episode.treated, episode.lastRelease)
  return {
    nerve,
    nervePeak,
    nervePeakTime: nerve.indexOf(nervePeak) * STEP,
    headache: episode.treated.map(sample => sample.headache),
    settlingTime: settledAt === undefined ? undefined : settledAt - episode.lastRelease,
  }
}
