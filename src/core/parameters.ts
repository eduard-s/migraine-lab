export const MODEL_VERSION = '0.1.0'
export const DURATION = 72
export const STEP = 0.25
export const FIRST_PULSE = 10

/** Example exposure shapes for the teaching model. Times are relative to the burst width. */
export const EXPOSURES = {
  brief: { label: 'Brief exposure', rise: 0.48, fall: 0.68 },
  sustained: { label: 'Sustained exposure', rise: 1, fall: 1 },
  gradual: { label: 'Gradual buildup', rise: 1.45, fall: 0.94 },
} as const

export const TRIGGERS = [
  { id: 'weather', name: 'Weather change', event: 'Atmospheric pressure shifts.', delay: 0, exposure: 'sustained' },
  { id: 'sleep', name: 'Disrupted sleep', event: 'A night of interrupted sleep.', delay: 2, exposure: 'gradual' },
  { id: 'meal', name: 'Missed meal', event: 'A usual meal is skipped.', delay: 4, exposure: 'gradual' },
  { id: 'stress', name: 'Stress', event: 'A stressful event occurs.', delay: 1, exposure: 'sustained' },
  { id: 'hydration', name: 'Dehydration', event: 'Fluid intake is lower than usual.', delay: 5, exposure: 'gradual' },
  { id: 'hormones', name: 'Hormonal change', event: 'A fluctuation in hormones, such as around menstruation.', delay: 6, exposure: 'gradual' },
  { id: 'caffeine', name: 'Caffeine withdrawal', event: 'Usual caffeine intake is interrupted.', delay: 3, exposure: 'gradual' },
  { id: 'light', name: 'Bright light', event: 'An intense light exposure. Light sensitivity can also be an early symptom.', delay: -2, exposure: 'brief' },
  { id: 'noise', name: 'Sudden noise', event: 'A sudden loud sound. Sound sensitivity can also be an early symptom.', delay: -1, exposure: 'brief' },
  { id: 'odor', name: 'Strong odor', event: 'A strong smell lingers in the room.', delay: 0.5, exposure: 'sustained' },
  { id: 'alcohol', name: 'Alcohol', event: 'An episode follows drinking alcohol.', delay: 7, exposure: 'gradual' },
  { id: 'exertion', name: 'Physical exertion', event: 'A short period of strenuous activity.', delay: 1.5, exposure: 'brief' },
] as const

export type Trigger = (typeof TRIGGERS)[number]
export type TriggerId = Trigger['id']
export type BodyModel = 'female' | 'male'
export type Scale = 'body' | 'head' | 'cells' | 'receptor'
export type HeadRegion = 'nerve' | 'cortex'
export type Pathway = 'cgrp' | 'pacap'
export type Target = 'release' | 'messenger' | 'receptor'
export type Intervention = 'none' | 'ubrogepant' | 'sumatriptan' | 'galcanezumab' | 'bocunebart' | 'amg301'

export const DEFAULT_FACTORS = Object.freeze({
  intensity: 76, sensitivity: 65, threshold: 26, onsetDelay: 0,
  sleepDebt: 0, stressLoad: 0, hydrationDeficit: 0, hormoneShift: 0,
  headacheSensitivity: 78, lightSensitivity: 64, nauseaSensitivity: 45, recoverySpeed: 54,
  cgrp: 78, pacap: 63, burst: 9, gap: 19, distance: 38, diffusion: 62, clearance: 43,
  receptors: 76, pac1: 65, responseDecay: 42, start: 15, strength: 72, engagement: 5,
  auraOnset: 6, auraSpeed: 42, auraRecovery: 9, aura: false,
})

export type Factors = { -readonly [Key in keyof typeof DEFAULT_FACTORS]: (typeof DEFAULT_FACTORS)[Key] extends boolean ? boolean : number }
export type NumericFactor = Exclude<keyof Factors, 'aura'>

export interface FactorDefinition {
  key: NumericFactor
  label: string
  description: string
  min: number
  max: number
  unit: 'relative units' | 'model time units'
}

const relative = (key: NumericFactor, label: string, description: string, max = 100): FactorDefinition =>
  ({ key, label, description, min: 0, max, unit: 'relative units' })
const timing = (key: NumericFactor, label: string, description: string, min: number, max: number): FactorDefinition =>
  ({ key, label, description, min, max, unit: 'model time units' })

export const TRIGGER_INTENSITY = relative('intensity', 'Trigger intensity', 'Sets the magnitude of the selected event in the model.')
export const FACTOR_GROUPS = [
  { label: 'Attack onset', factors: [
    relative('sensitivity', 'Trigger sensitivity', 'Scales how strongly the same event affects this case.'),
    relative('threshold', 'Attack threshold', 'The combined trigger input must cross this level.', 90),
    timing('onsetDelay', 'Extra onset delay', 'Adds a delay to the selected event’s teaching timeline.', 0, 14),
  ] },
  { label: 'Background factors', factors: [
    relative('sleepDebt', 'Recent sleep debt', 'Adds background input from disrupted sleep before the event.'),
    relative('stressLoad', 'Ongoing stress', 'Adds background input before the selected event.'),
    relative('hydrationDeficit', 'Hydration deficit', 'Adds background input from lower fluid intake.'),
    relative('hormoneShift', 'Hormonal fluctuation', 'Adds background input independently of the selected body.'),
  ] },
  { label: 'Symptoms and recovery', factors: [
    relative('headacheSensitivity', 'Headache sensitivity', 'Changes how strongly the nerve signal appears as modeled head pain.'),
    relative('lightSensitivity', 'Light sensitivity', 'Changes the modeled discomfort from light during the episode.'),
    relative('nauseaSensitivity', 'Nausea sensitivity', 'Changes the modeled nausea response.'),
    relative('recoverySpeed', 'Recovery speed', 'Higher values make symptoms settle sooner as the nerve signal falls.'),
  ] },
  { label: 'Messenger release', factors: [
    relative('cgrp', 'CGRP released', 'Sets the amount of CGRP that the nerve can release.'),
    relative('pacap', 'PACAP released', 'Sets the amount of PACAP that the nerve can release.'),
    timing('burst', 'Burst duration', 'Changes how long each release pulse lasts.', 3, 18),
    timing('gap', 'Time between bursts', 'Sets the separation between the two pulses.', 6, 30),
  ] },
  { label: 'Space between cells', factors: [
    relative('distance', 'Distance between cells', 'Larger gaps slow the arrival of released messengers.'),
    relative('diffusion', 'Transport rate', 'Higher values move messengers across the gap faster.'),
    relative('clearance', 'Messenger clearance', 'Higher values remove messengers from the gap faster.'),
  ] },
  { label: 'Receiving cell', factors: [
    relative('receptors', 'CGRP receptor abundance', 'Sets how strongly the receiving cell can respond to CGRP.'),
    relative('pac1', 'PAC1 share of PACAP response', 'Changes the fraction of PACAP signaling carried by PAC1 receptors.'),
    relative('responseDecay', 'Cell signal decay', 'Sets how quickly activity fades inside the receiving cell.'),
  ] },
  { label: 'Treatment in the model', factors: [
    timing('start', 'Earliest treatment start', 'Sets the earliest model time the intervention can reach its target.', 0, DURATION),
    relative('strength', 'Target strength', 'Sets the maximum modeled effect at the target.'),
    timing('engagement', 'Time to reach target', 'Higher values make the intervention engage more slowly.', 1, 18),
  ] },
  { label: 'Visual aura', factors: [
    timing('auraOnset', 'Aura begins', 'Sets when the visual cortex wave begins in an aura episode.', 0, 30),
    relative('auraSpeed', 'Wave speed', 'Sets how fast the wave crosses the cortex and visual field.'),
    timing('auraRecovery', 'Visual recovery time', 'Sets how long activity stays altered behind the wave.', 2, 24),
  ] },
] as const

export const FACTORS: readonly FactorDefinition[] = [TRIGGER_INTENSITY, ...FACTOR_GROUPS.flatMap(group => group.factors)]

export const LEVELS: ReadonlyArray<{ id: Scale; label: string }> = [
  { id: 'body', label: 'Body' }, { id: 'head', label: 'Head' },
  { id: 'cells', label: 'Cells' }, { id: 'receptor', label: 'Receptor' },
]
