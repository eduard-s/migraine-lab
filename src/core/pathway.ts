import { DURATION, STEP } from './parameters.js'
import type { Sample } from './model.js'
import type { Factors } from './parameters.js'

export const CORTEX_COLUMNS = 17
export const CORTEX_ROWS = 5
export const CORTEX_SIZE = CORTEX_COLUMNS * CORTEX_ROWS
export const DEFAULT_SPARK = 2 + 2 * CORTEX_COLUMNS

export const PATHWAY_DEFAULTS = Object.freeze({
  brainState: 50,
  glutamate: 50,
  cleanup: 50,
  interneuron: 50,
  nmda: 50,
  energy: 50,
  sparkStrength: 74,
  windUp: 50,
  brake: 50,
  touch: 18,
  relayRecovery: 50,
  light: 50,
  thalamicGain: 50,
  nmdaBlock: false,
  darkRoom: false,
})

export type PathwaySettings = { -readonly [K in keyof typeof PATHWAY_DEFAULTS]: (typeof PATHWAY_DEFAULTS)[K] extends boolean ? boolean : number }
export type CortexState = 'resting' | 'wave' | 'quiet'
export type CortexCell = { potassium: number; glutamate: number; state: CortexState; flow: number; ignitedAt: number }
export type CortexFrame = { cells: CortexCell[]; crossed: number; active: number }
export type PainPathwayFrame = {
  time: number
  cgrp: number
  release: number
  vessel: number
  incoming: number
  relay: number
  relayGain: number
  touchResponse: number
  lightDrive: number
  visualDrive: number
  touchSpread: number
  thalamus: number
  headache: number
}

const limit = (value: number) => Math.max(0, Math.min(1, value))
const fraction = (value: number) => value / 100

const neighbors = Array.from({ length: CORTEX_SIZE }, (_, index) => {
  const column = index % CORTEX_COLUMNS
  const row = Math.floor(index / CORTEX_COLUMNS)
  return [
    column === 0 ? index : index - 1,
    column === CORTEX_COLUMNS - 1 ? index : index + 1,
    row === 0 ? index : index - CORTEX_COLUMNS,
    row === CORTEX_ROWS - 1 ? index : index + CORTEX_COLUMNS,
  ]
})

/** A dimensionless excitable grid for the cortex experiment. The pain pathway has its own input. */
export function simulateCortex(settings: PathwaySettings, enabled: boolean, onset: number, spark: number): CortexFrame[] {
  const threshold = .65 - .2 * fraction(settings.brainState)
  const potassiumRest = .09 + .12 * fraction(settings.interneuron)
  const glutamateRest = .025
  const nmda = (.42 + 1.55 * fraction(settings.nmda)) * (settings.nmdaBlock ? .08 : 1)
  const energy = .53 + .94 * fraction(settings.energy)
  const clearance = .26 + .56 * fraction(settings.cleanup)
  const refractory = 5.9 / (energy * (.62 + .76 * fraction(settings.cleanup)))
  const release = .16 + 2.32 * fraction(settings.glutamate)
  const activeFor = 1.125
  const potassium = new Float32Array(CORTEX_SIZE).fill(potassiumRest)
  const glutamate = new Float32Array(CORTEX_SIZE).fill(glutamateRest)
  const nextK = new Float32Array(CORTEX_SIZE)
  const nextG = new Float32Array(CORTEX_SIZE)
  const ignited = new Float32Array(CORTEX_SIZE).fill(-1)
  const step = STEP / 2
  const seedFrame = Math.round(onset / step)
  const strength = fraction(settings.sparkStrength)
  const frames: CortexFrame[] = []

  for (let tick = 0; tick <= DURATION / step; tick++) {
    const time = tick * step
    if (enabled && tick === seedFrame) {
      potassium[spark] += 1.17 * strength
      glutamate[spark] += .34 * strength
    }
    if (enabled) {
      for (let cell = 0; cell < CORTEX_SIZE; cell++) {
        const [left, right, above, below] = neighbors[cell]
        const k = potassium[cell]
        const g = glutamate[cell]
        // Each cell participates in at most one wave during this teaching run.
        if (ignited[cell] < 0 && k + nmda * g >= threshold) ignited[cell] = time
        const age = ignited[cell] < 0 ? Infinity : time - ignited[cell]
        const firing = age < activeFor
        const flow = age < Infinity ? 1 + .27 * Math.exp(-age / 1.1) - .22 * (1 - Math.exp(-age / 1.25)) * Math.exp(-age / 9) : 1
        const cleanup = clearance * energy * flow
        const laplaceK = potassium[left] + potassium[right] + potassium[above] + potassium[below] - 4 * k
        const laplaceG = glutamate[left] + glutamate[right] + glutamate[above] + glutamate[below] - 4 * g
        nextK[cell] = Math.max(potassiumRest, k + step * (.97 * laplaceK - cleanup * (k - potassiumRest) + (firing ? 3 : 0)))
        nextG[cell] = Math.max(glutamateRest, g + step * (.90 * laplaceG - cleanup * (g - glutamateRest) + (firing ? release : 0)))
      }
      potassium.set(nextK)
      glutamate.set(nextG)
    }
    if (tick % 2 !== 0) continue
    let active = 0
    let crossed = 0
    const cells = Array.from({ length: CORTEX_SIZE }, (_, cell): CortexCell => {
      const ignitedAt = ignited[cell]
      const age = ignitedAt < 0 ? Infinity : time - ignitedAt
      const state = age < activeFor ? 'wave' : age < activeFor + refractory ? 'quiet' : 'resting'
      if (state === 'wave') active++
      if (ignitedAt >= 0) crossed++
      const flow = age < Infinity ? 1 + .27 * Math.exp(-age / 1.1) - .22 * (1 - Math.exp(-age / 1.25)) * Math.exp(-age / 9) : 1
      return { potassium: limit(potassium[cell]), glutamate: limit(glutamate[cell]), state, flow, ignitedAt }
    })
    frames.push({ cells, crossed: crossed / CORTEX_SIZE, active: active / CORTEX_SIZE })
  }
  return frames
}

export function cgrpReleaseLevel(released: number) {
  return limit(released / 3.9)
}

/** Illustrative relay and light inputs driven by the episode's existing meningeal signals. */
export function simulatePainPathway(samples: readonly Sample[], settings: PathwaySettings,
  factors: Pick<Factors, 'headacheSensitivity' | 'recoverySpeed'>): PainPathwayFrame[] {
  const brake = (.10 + .33 * fraction(settings.brake)) * (1 - .3 * fraction(settings.brainState))
  const touch = .52 * fraction(settings.touch)
  const light = settings.darkRoom ? 0 : fraction(settings.light)
  const thalamicGain = .42 + .64 * fraction(settings.thalamicGain)
  const windUp = .04 + .53 * fraction(settings.windUp)
  const recovery = .032 + .38 * fraction(settings.relayRecovery)
  const painRecovery = .055 + .0038 * factors.recoverySpeed
  let incoming = 0
  let gain = 1
  let ascending = 0
  let thalamus = 0
  let pain = 0
  let centralGain = 1

  return samples.map(sample => {
    const drive = limit(1.55 * (.65 * sample.cgrpSignal + .35 * sample.pacapSignal))
    incoming += STEP * (drive - incoming) * .72
    gain += STEP * (windUp * incoming * (2.6 - gain) - recovery * (gain - 1))
    const relay = limit(.72 * gain * incoming - brake)
    const touchResponse = limit(gain * touch - brake)
    ascending += STEP * (relay - ascending) * .59
    const lightDrive = .57 * light * ascending
    thalamus += STEP * (limit(thalamicGain * (ascending + lightDrive)) - thalamus) * .83
    pain += STEP * (thalamus - pain) * (thalamus >= pain ? .78 : painRecovery)
    centralGain += STEP * (.21 * ascending * (1.8 - centralGain) - .075 * (centralGain - 1))
    return {
      time: sample.time,
      cgrp: limit(sample.freeCgrp),
      release: cgrpReleaseLevel(sample.releasedCgrp),
      vessel: Math.min(1, sample.cgrpSignal * 1.8),
      incoming,
      relay,
      relayGain: gain,
      touchResponse,
      lightDrive,
      visualDrive: light,
      touchSpread: limit(touch * thalamicGain * centralGain - .16),
      thalamus,
      headache: pain * fraction(factors.headacheSensitivity),
    }
  })
}
