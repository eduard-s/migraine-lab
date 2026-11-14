import { findTreatment } from './evidence.js'
import { DEFAULT_FACTORS, DURATION, EXPOSURES, FACTORS, FIRST_PULSE, MODEL_VERSION, STEP, TRIGGERS, type Factors, type Intervention, type TriggerId } from './parameters.js'

export interface Sample {
  time: number
  releasedCgrp: number
  releasedPacap: number
  freeCgrp: number
  freePacap: number
  cgrpSignal: number
  pacapSignal: number
  cgrpOccupied: number
  pac1Occupied: number
  headache: number
  lightSensitivity: number
  nausea: number
  auraFront: number
  auraWake: number
  engagement: number
}

export type EpisodePhase = 'Ready' | 'Below threshold' | 'Trigger' | 'Aura' | 'Attack' | 'Recovery' | 'Settled'

export interface EpisodeOptions {
  trigger?: TriggerId
  factors?: Partial<Factors>
  treatment?: Intervention
  triggered?: boolean
  /** Omit to use the configured start. A live treatment cannot start before this time. */
  treatmentAppliedAt?: number
}

export interface EpisodeComparison {
  trigger: TriggerId
  treatment: Intervention
  treatmentAppliedAt?: number
  factors: Factors
  triggered: boolean
  triggerInput: number
  firstPeak: number
  firstRelease: number
  lastRelease: number
  baseline: Sample[]
  treated: Sample[]
}

export function treatmentStart(treatment: Intervention) {
  const selected = findTreatment(treatment)
  return selected && selected.status !== 'Acute treatment' ? 0 : DEFAULT_FACTORS.start
}

export function createFactors(overrides: Partial<Factors> = {}, treatment: Intervention = 'none'): Factors {
  const factors: Factors = { ...DEFAULT_FACTORS, start: treatmentStart(treatment) }
  for (const { key, min, max } of FACTORS) {
    const value = overrides[key]
    if (typeof value === 'number' && Number.isFinite(value)) factors[key] = Math.max(min, Math.min(max, value))
  }
  return { ...factors, aura: typeof overrides.aura === 'boolean' ? overrides.aura : factors.aura }
}

const fraction = (value: number) => value / 100
const unit = (value: number) => Math.max(0, Math.min(1, value))

export function visualAuraAt(elapsed: number, factors: Pick<Factors, 'auraSpeed' | 'auraRecovery'>) {
  const speed = 0.012 + 0.00057 * factors.auraSpeed
  return {
    auraFront: Math.max(0, elapsed) * speed,
    auraWake: Math.max(0, elapsed - factors.auraRecovery) * speed,
  }
}

export function triggerInput(factors: Factors): number {
  const background = 1 - [factors.sleepDebt, factors.stressLoad, factors.hydrationDeficit, factors.hormoneShift]
    .reduce((remaining, factor) => remaining * (1 - 0.36 * fraction(factor)), 1)
  return unit((fraction(factors.intensity) + background) * (0.48 + 0.82 * fraction(factors.sensitivity)))
}

function simulate(factors: Factors, intervention: Intervention, activation: number, firstPeak: number,
  rise: number, fall: number, appliedAt: number | undefined): Sample[] {
  const { cgrp, pacap, gap, distance, diffusion, clearance, receptors, pac1, responseDecay } = factors
  const treatment = findTreatment(intervention)
  const cgrpTarget = treatment?.pathway === 'cgrp' ? treatment.target : undefined
  const pacapTarget = treatment?.pathway === 'pacap' ? treatment.target : undefined
  const travel = (0.08 + 0.57 * fraction(diffusion)) / (1 + 0.018 * distance)
  const removal = 0.05 + 0.46 * fraction(clearance)
  const decay = 0.07 + 0.65 * fraction(responseDecay)
  const strength = fraction(factors.strength)
  const pac1Share = fraction(pac1)
  const recovery = 0.055 + 0.0038 * factors.recoverySpeed
  const exposure = Math.max(factors.start, appliedAt ?? 0)
  let localCgrp = 0
  let localPacap = 0
  let cgrpSignal = 0
  let pacapSignal = 0
  let symptoms = 0

  function pulse(time: number, center: number) {
    const offset = time - center
    return Math.max(0, 1 - Math.abs(offset) / (offset < 0 ? rise : fall))
  }

  return Array.from({ length: DURATION / STEP + 1 }, (_, frame) => {
    const time = frame * STEP
    const input = activation * (pulse(time, firstPeak) + 0.58 * pulse(time, firstPeak + gap))
    const elapsed = Math.max(0, time - exposure)
    const engagement = treatment && activation > 0 ? strength * (1 - Math.exp(-elapsed / factors.engagement)) : 0
    const releasedCgrp = 3.9 * fraction(cgrp) * input * (cgrpTarget === 'release' ? 1 - 0.86 * engagement : 1)
    const releasedPacap = 3.9 * fraction(pacap) * input
    localCgrp += STEP * (travel * releasedCgrp - (travel + removal) * localCgrp)
    localPacap += STEP * (travel * releasedPacap - (travel + removal) * localPacap)

    const freeCgrp = localCgrp / (cgrpTarget === 'messenger' ? 1 + 5 * engagement : 1)
    const freePacap = localPacap / (pacapTarget === 'messenger' ? 1 + 5 * engagement : 1)
    const cgrpBlock = cgrpTarget === 'receptor' ? 6 * engagement : 0
    const pac1Block = pacapTarget === 'receptor' ? 6 * engagement : 0
    const cgrpOccupied = freeCgrp / (freeCgrp + 0.35 * (1 + cgrpBlock))
    const pac1Occupied = freePacap / (freePacap + 0.35 * (1 + pac1Block))
    const otherPacapResponse = freePacap / (freePacap + 0.5)
    const pacapActivation = pac1Share * pac1Occupied + (1 - pac1Share) * otherPacapResponse
    cgrpSignal += STEP * (0.95 * fraction(receptors) * cgrpOccupied * (1 - cgrpSignal) - decay * cgrpSignal)
    pacapSignal += STEP * (0.82 * pacapActivation * (1 - pacapSignal) - decay * pacapSignal)

    const symptomDrive = unit(1.65 * (0.63 * cgrpSignal + 0.37 * pacapSignal))
    symptoms += STEP * (symptomDrive - symptoms) * (symptomDrive >= symptoms ? 0.78 : recovery)
    const waveTime = activation > 0 && factors.aura ? Math.max(0, time - factors.auraOnset) : 0
    return {
      time, releasedCgrp, releasedPacap, freeCgrp, freePacap, cgrpSignal, pacapSignal,
      cgrpOccupied, pac1Occupied, engagement,
      headache: symptoms * fraction(factors.headacheSensitivity),
      lightSensitivity: symptoms * fraction(factors.lightSensitivity),
      nausea: symptoms * fraction(factors.nauseaSensitivity),
      ...visualAuraAt(waveTime, factors),
    }
  })
}

/** Both runs use the same teaching pathway, event, and factors. */
export function compareEpisode({
  trigger = 'weather', factors: overrides, treatment = 'none', triggered = true, treatmentAppliedAt,
}: EpisodeOptions = {}): EpisodeComparison {
  const factors = createFactors(overrides, treatment)
  const load = triggerInput(factors)
  const threshold = fraction(factors.threshold)
  const activation = triggered ? unit((load - threshold) / (1 - threshold)) : 0
  const event = TRIGGERS.find(event => event.id === trigger) ?? TRIGGERS[0]
  const firstPeak = FIRST_PULSE + event.delay + factors.onsetDelay
  const exposure = EXPOSURES[event.exposure]
  const rise = factors.burst / 2 * exposure.rise
  const fall = factors.burst / 2 * exposure.fall
  const appliedAt = treatmentAppliedAt !== undefined && Number.isFinite(treatmentAppliedAt)
    ? Math.max(0, Math.min(DURATION, treatmentAppliedAt)) : undefined
  const baseline = simulate(factors, 'none', activation, firstPeak, rise, fall, undefined)
  const treated = treatment === 'none' ? baseline : simulate(factors, treatment, activation, firstPeak, rise, fall, appliedAt)
  return {
    trigger, treatment, treatmentAppliedAt: appliedAt, factors, triggered, triggerInput: load, firstPeak,
    firstRelease: Math.max(0, firstPeak - rise), lastRelease: firstPeak + factors.gap + fall,
    baseline, treated,
  }
}

export function sampleAt(samples: readonly Sample[], time: number): Sample {
  if (samples.length === 0) throw new RangeError('An episode must contain at least one sample.')
  const index = Number.isNaN(time) ? 0 : Math.max(0, Math.min(samples.length - 1, Math.round(time / STEP)))
  return samples[index]
}

export function isAuraActive(sample: Sample) {
  return sample.auraFront > 0 && sample.auraWake < 1
}

export function episodePhase(episode: EpisodeComparison, sample: Sample): EpisodePhase {
  if (!episode.triggered) return 'Ready'
  if (episode.triggerInput <= fraction(episode.factors.threshold)) return 'Below threshold'
  if (sample.time < episode.firstPeak && isAuraActive(sample)) return 'Aura'
  if (sample.time < episode.firstRelease) return 'Trigger'
  if (sample.time < episode.lastRelease) return 'Attack'
  return Math.max(sample.headache, sample.lightSensitivity, sample.nausea, sample.cgrpSignal, sample.pacapSignal) > 0.025 ? 'Recovery' : 'Settled'
}

export function treatmentEffectTime(episode: EpisodeComparison): number {
  const treatment = findTreatment(episode.treatment)
  if (!treatment) return episode.firstRelease
  const signal = treatment.pathway === 'cgrp' ? 'cgrpSignal' : 'pacapSignal'
  let time = episode.firstPeak + episode.factors.gap
  let difference = 0
  episode.baseline.forEach((sample, index) => {
    const change = sample[signal] - episode.treated[index][signal]
    if (change > difference) {
      difference = change
      time = sample.time
    }
  })
  return time
}

export function randomTrigger(current: TriggerId, random = Math.random): TriggerId {
  const choices = TRIGGERS.filter(trigger => trigger.id !== current)
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))].id
}

export function episodeCsv({ trigger, treatment, treatmentAppliedAt, factors, baseline, treated }: EpisodeComparison): string {
  const keys = Object.keys(DEFAULT_FACTORS) as (keyof Factors)[]
  const measures = [
    'releasedCgrp', 'releasedPacap', 'freeCgrp', 'freePacap', 'cgrpSignal', 'pacapSignal', 'cgrpOccupied', 'pac1Occupied',
    'headache', 'lightSensitivity', 'nausea', 'auraFront', 'auraWake', 'engagement',
  ] as const
  const header = ['model_version', 'trigger', 'treatment', 'treatment_applied_at', ...keys, 'model_time', ...measures.flatMap(key => ['untreated_' + key, 'treated_' + key])]
  const rows = treated.map((row, index) => [
    MODEL_VERSION, trigger, treatment, treatmentAppliedAt ?? '', ...keys.map(key => factors[key]), row.time,
    ...measures.flatMap(key => [baseline[index][key], row[key]]),
  ].map(value => typeof value === 'number' ? Number(value.toFixed(5)) : value).join(','))
  return [header.join(','), ...rows].join('\n') + '\n'
}
