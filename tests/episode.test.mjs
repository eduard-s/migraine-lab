import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  compareEpisode, createFactors, DEFAULT_FACTORS, DURATION, episodeCsv, episodePhase,
  FACTORS, isAuraActive, randomTrigger, sampleAt, treatmentEffectTime, TRIGGERS, visualAuraAt,
} from '../dist/core/index.js'

test('all numeric settings are independent and bounded', () => {
  assert.equal(FACTORS.length, Object.keys(DEFAULT_FACTORS).length - 1)
  assert.equal(new Set(FACTORS.map(({ key }) => key)).size, FACTORS.length)
  assert.deepEqual(createFactors({ recoverySpeed: 300, onsetDelay: -3, cgrp: Number.NaN, aura: true }),
    { ...DEFAULT_FACTORS, recoverySpeed: 100, onsetDelay: 0, aura: true })
  assert.equal(createFactors({}, 'galcanezumab').start, 0)
  assert.equal(createFactors({ start: 11 }, 'galcanezumab').start, 11)
})

test('trigger sensitivity, threshold and background input affect attack onset', () => {
  const ready = compareEpisode({ triggered: false })
  const below = compareEpisode({ factors: { intensity: 10, aura: true } })
  const delayed = compareEpisode({ factors: { intensity: 10, stressLoad: 100, onsetDelay: 4 } })
  assert.equal(episodePhase(ready, sampleAt(ready.baseline, 14)), 'Ready')
  assert.equal(episodePhase(below, sampleAt(below.baseline, 14)), 'Below threshold')
  assert.equal(below.baseline.some(isAuraActive), false)
  assert.equal(delayed.firstPeak, 14)
  assert.equal(compareEpisode({ trigger: 'meal' }).firstPeak - compareEpisode().firstPeak, 4)
  assert.equal(sampleAt(delayed.baseline, 9).releasedCgrp, 0)
  assert(sampleAt(delayed.baseline, 14).releasedCgrp > 0)
  assert.equal(new Set(TRIGGERS.map(trigger => trigger.id)).size, TRIGGERS.length)
  assert.notEqual(randomTrigger('weather', () => 0), 'weather')
})

test('different exposures produce different release curves at the same peak and intensity', () => {
  const brief = compareEpisode({ trigger: 'light', factors: { onsetDelay: 4 } })
  const sustained = compareEpisode({ trigger: 'weather', factors: { onsetDelay: 2 } })
  const gradual = compareEpisode({ trigger: 'sleep' })
  assert.equal(brief.firstPeak, sustained.firstPeak)
  assert.equal(brief.firstPeak, gradual.firstPeak)
  assert.equal(brief.triggerInput, gradual.triggerInput)
  assert(gradual.firstRelease < sustained.firstRelease && sustained.firstRelease < brief.firstRelease)
  const beforePeak = brief.firstPeak - 2.5
  assert.equal(sampleAt(brief.baseline, beforePeak).releasedCgrp, 0)
  assert(sampleAt(gradual.baseline, beforePeak).releasedCgrp > sampleAt(sustained.baseline, beforePeak).releasedCgrp)
  assert(sampleAt(brief.baseline, brief.firstPeak + 2).cgrpSignal < sampleAt(sustained.baseline, brief.firstPeak + 2).cgrpSignal)
})

test('treatments change their selected target in matched runs', () => {
  const receptor = compareEpisode({ treatment: 'ubrogepant', factors: { aura: true } })
  const nerve = compareEpisode({ treatment: 'sumatriptan' })
  const cgrpAntibody = compareEpisode({ treatment: 'galcanezumab' })
  const pacapAntibody = compareEpisode({ treatment: 'bocunebart' })
  const pac1 = compareEpisode({ treatment: 'amg301' })
  for (const run of [receptor, nerve, cgrpAntibody, pacapAntibody, pac1]) {
    const time = treatmentEffectTime(run)
    const untreated = sampleAt(run.baseline, time)
    const treated = sampleAt(run.treated, time)
    assert.equal(untreated.time, treated.time)
    assert.equal(untreated.auraFront, treated.auraFront)
    assert(treated.engagement > 0)
  }
  const difference = (run, key) => {
    const time = treatmentEffectTime(run)
    return sampleAt(run.baseline, time)[key] - sampleAt(run.treated, time)[key]
  }
  assert(difference(receptor, 'cgrpOccupied') > 0)
  assert.equal(difference(receptor, 'freeCgrp'), 0)
  assert(difference(nerve, 'releasedCgrp') > 0)
  assert(difference(cgrpAntibody, 'freeCgrp') > 0)
  assert(difference(pacapAntibody, 'freePacap') > 0)
  assert(difference(pac1, 'pac1Occupied') > 0)
})

test('symptom recovery, cellular decay and aura use independent settings', () => {
  const slow = compareEpisode({ factors: { aura: true, recoverySpeed: 0 } })
  const fast = compareEpisode({ factors: { aura: true, recoverySpeed: 100 } })
  const time = 46
  const a = sampleAt(slow.baseline, time)
  const b = sampleAt(fast.baseline, time)
  assert(b.headache < a.headache)
  assert.equal(a.cgrpSignal, b.cgrpSignal)
  assert.equal(a.auraWake, b.auraWake)
  const wave = compareEpisode({ factors: { aura: true, auraOnset: 9, auraRecovery: 14 } })
  assert.equal(isAuraActive(sampleAt(wave.baseline, 9)), false)
  assert(isAuraActive(sampleAt(wave.baseline, 16)))
  assert.equal(sampleAt(wave.baseline, 17).auraWake, 0)
  assert.equal(episodePhase(fast, sampleAt(fast.baseline, DURATION)), 'Settled')
  const [header, first] = episodeCsv(fast).split('\n')
  assert.equal(header.split(',').length, first.split(',').length)
  for (const key of Object.keys(DEFAULT_FACTORS)) assert(header.split(',').includes(key), key)
})


test('a treatment selected during an episode acts only after its application', () => {
  const run = compareEpisode({ treatment: 'ubrogepant', treatmentAppliedAt: 24.1 })
  const before = sampleAt(run.treated, 23)
  assert.deepEqual(before, sampleAt(run.baseline, 23))
  assert.equal(sampleAt(run.treated, 24).engagement, 0)
  assert(sampleAt(run.treated, 31).engagement > 0)
  assert(sampleAt(run.treated, 31).cgrpSignal < sampleAt(run.baseline, 31).cgrpSignal)
  const delayed = compareEpisode({ treatment: 'ubrogepant', treatmentAppliedAt: 7, factors: { start: 22 } })
  assert.equal(sampleAt(delayed.treated, 21).engagement, 0)
  assert(sampleAt(delayed.treated, 23).engagement > 0)
  assert(episodeCsv(run).split('\n')[1].includes(',24.1,'))
})

test('the visual aura preview uses the same wave rule as the episode', () => {
  const run = compareEpisode({ factors: { aura: true, auraSpeed: 61, auraRecovery: 7 } })
  const sample = sampleAt(run.baseline, 19)
  assert.deepEqual(visualAuraAt(13, run.factors), { auraFront: sample.auraFront, auraWake: sample.auraWake })
  assert.equal(visualAuraAt(0, run.factors).auraFront, 0)
})
