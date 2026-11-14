import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type RefObject } from 'react'
import { DURATION, STEP, compareEpisode, createFactors, type EpisodeComparison, type Factors } from '../core/index.js'
import { CORTEX_COLUMNS, DEFAULT_SPARK, PATHWAY_DEFAULTS, simulateCortex, simulatePainPathway, type PathwaySettings } from '../core/pathway.js'
import { HeadRecovery, type PinnedTreatment } from './HeadRecovery.js'
import { Icon } from './icon.js'
import type { MigraineLabProps } from './MigraineLab.js'
import { MigraineVision } from './MigraineViews.js'
import { PathwayHeadMap } from './PathwayHeadMap.js'
import { CortexStage, PainStage, SynapseStage } from './PathwayStages.js'
import { PathwayTraces, type ProbeRun } from './PathwayTraces.js'
import { ReceptorMicroscope } from './ReceptorMicroscope.js'
import { sampleBetween, treatmentTargetTime } from './workbench-episode.js'
import { cortexPresets, pathwayEvidence, pathwayExperiments, stations, type PathwayControl, type PathwayFactor, type Station } from './pathway-content.js'

type CortexScale = 'Whole cortex' | 'Tissue patch' | 'One synapse'
type Tool = 'probe' | 'poke'
type Preset = keyof typeof cortexPresets
type View = Station | 'binding' | 'recovery'
type ModelInputs = {
  settings: PathwaySettings
  aura: boolean
  spark: number
  onset: number
  factors: Pick<Factors, PathwayFactor>
}

const cortexScales: readonly CortexScale[] = ['Whole cortex', 'Tissue patch', 'One synapse']
const defaultProbe = 8 + CORTEX_COLUMNS * 2
const asLevel = (level: number) => Math.round(level * 100)
const playbackMoments = [6, 9, 12, 16, 22, 32, 42, 54, 72]
const bindingApproach = 1.25
const bindingLead = 1.5
const progressKey = 'migraine-pathway-experiments-v1'
const unit = (value: number) => Math.max(0, Math.min(1, value))
const bindingDrugs = [
  { id: 'sumatriptan', label: 'Sumatriptan', className: 'Triptan', target: 'Reduces CGRP release' },
  { id: 'ubrogepant', label: 'Ubrogepant (Ubrelvy)', className: 'Gepant', target: 'Blocks the CGRP receptor' },
  { id: 'galcanezumab', label: 'Galcanezumab', className: 'Preventive antibody', target: 'Binds free CGRP' },
] as const
type BindingDrug = (typeof bindingDrugs)[number]['id']

const steps: readonly { id: View; name: string }[] = [
  ...stations,
  { id: 'binding', name: 'Drug binding' },
  { id: 'recovery', name: 'Pain recovery' },
]
const rates: Record<View, number> = { cortex: 1, meninges: 1, relay: 1.1, thalamus: 1.9, binding: 1.3, recovery: 3.6 }

function isFactor(key: PathwayControl['key']): key is PathwayFactor {
  return key === 'cgrp' || key === 'clearance' || key === 'receptors' || key === 'recoverySpeed'
}

function stationTimes(episode: EpisodeComparison, auraOnset: number, aura: boolean) {
  const meninges = Math.max(aura ? auraOnset + 4 : 6, Math.min(episode.firstPeak - .5, 13))
  const relay = Math.max(meninges + 3.5, episode.firstPeak + 3)
  const thalamus = Math.max(relay + 3.5, episode.firstPeak + 6.5)
  const binding = Math.min(DURATION - 6, Math.max(thalamus + 4, episode.firstPeak + episode.factors.gap - 5))
  return { cortex: 0, meninges, relay, thalamus, binding }
}

function NumberControl({ id, control, value, number, focused, select, change }: {
  id: string; control: PathwayControl; value: number; number?: number; focused?: boolean; select?: () => void; change: (value: number) => void
}) {
  return <div className="mp-control" data-selected={focused}>
    <label htmlFor={id}>{number && <i>{number}</i>}<span>{control.label}</span><output htmlFor={id}>{value}</output></label>
    <input id={id} type="range" min={0} max={100} value={value} aria-describedby={id + '-hint'} onFocus={select}
      onChange={event => change(event.currentTarget.valueAsNumber)} />
    <p id={id + '-hint'}>{control.effect}</p>
  </div>
}

function compareTreatment(reference: EpisodeComparison, treatment: BindingDrug, exposure: number) {
  return compareEpisode({
    trigger: reference.trigger,
    factors: { ...reference.factors, start: exposure },
    treatment,
    treatmentAppliedAt: exposure,
  })
}

function TreatmentTiming({ id, min, max, value, treatment, pinnedTime, change, onPin, onClear }: {
  id: string
  min: number
  max: number
  value: number
  treatment: BindingDrug
  pinnedTime?: number
  change: (value: number) => void
  onPin?: () => void
  onClear: () => void
}) {
  const preventive = treatment === 'galcanezumab'
  const instructions = preventive ? id + '-preventive' : undefined
  const pinAt = pinnedTime === undefined ? undefined : (pinnedTime - min) / (max - min)
  return <div className="mw-treatment-timing">
    <div>
      <label htmlFor={id}>{onPin ? 'Treatment time' : 'Shared treatment time'}</label>
      <output htmlFor={id} aria-live="off">{value} <small>model time units</small></output>
    </div>
    <div className="mw-treatment-range">
      {pinAt !== undefined && pinAt >= 0 && pinAt <= 1 &&
        <i className="mw-treatment-pin-mark" style={{ left: `calc(${pinAt * 100}% + ${(1 - 2 * pinAt) * 10}px)` }}
          aria-hidden="true" />}
      <input id={id} type="range" min={min} max={max} step={STEP} value={value}
        aria-describedby={instructions}
        aria-valuetext={value + ' model time units from the start of the run'}
        onChange={event => change(event.currentTarget.valueAsNumber)} />
    </div>
    {onPin && <div aria-hidden="true"><span>Earlier</span><span>Later</span></div>}
    {preventive && <p id={id + '-preventive'}>Galcanezumab is preventive. This slider shifts when the antibody enters the model.</p>}
    {onPin && <div className="mw-treatment-pin">
      <span role="status">{pinnedTime === undefined ? 'Pin a time, then move the slider to compare.' :
        'Pinned at ' + pinnedTime + '. The slider changes the current run.'}</span>
      <button type="button" className="mw-rx-next" onClick={onPin}>
        <Icon name="pin" size={15} /> {pinnedTime === undefined ? 'Pin treatment run' : 'Replace pin'}
      </button>
      {pinnedTime !== undefined && <button type="button" className="mw-rx-next" onClick={onClear}>
        <Icon name="close" size={14} /> Clear pin
      </button>}
    </div>}
  </div>
}

export function MigrainePathway({ options, root, onBack }: {
  options: MigraineLabProps; root?: RefObject<HTMLButtonElement | null>; onBack?: () => void
}) {
  const id = useId()
  const panel = useRef<HTMLElement>(null)
  const stagePanel = useRef<HTMLDivElement>(null)
  const focusStep = useRef<View | undefined>(undefined)
  const evidence = useRef<HTMLDetailsElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const initialFactors = useMemo(() => createFactors({ aura: true, engagement: 2.2, ...options.initialFactors }), [options.initialFactors])
  const [inputs, setInputs] = useState<ModelInputs>(() => ({
    settings: { ...PATHWAY_DEFAULTS },
    aura: initialFactors.aura,
    spark: DEFAULT_SPARK,
    onset: initialFactors.auraOnset,
    factors: { cgrp: initialFactors.cgrp, clearance: initialFactors.clearance, receptors: initialFactors.receptors, recoverySpeed: initialFactors.recoverySpeed },
  }))
  const [selectedTreatment, setTreatment] = useState<BindingDrug>(() =>
    bindingDrugs.find(drug => drug.id === options.initialTreatment)?.id ?? 'ubrogepant')
  const [sameTime, setSameTime] = useState(false)
  const treatment = sameTime ? 'ubrogepant' : selectedTreatment
  const [scheduledDose, setScheduledDose] = useState<number>()
  const [pinnedRun, setPinnedRun] = useState<PinnedTreatment & { reference: EpisodeComparison; settings: PathwaySettings }>()
  const [replayingTreatment, setReplayingTreatment] = useState(false)
  const [inspection, setInspection] = useState<View>()
  const [scale, setScale] = useState<CortexScale>('Whole cortex')
  const [tool, setTool] = useState<Tool>('probe')
  const [probe, setProbe] = useState(defaultProbe)
  const [cursor, setCursor] = useState(defaultProbe)
  const [selected, setSelected] = useState(1)
  const [preset, setPreset] = useState<Preset | 'custom'>('typical')
  const [previous, setPrevious] = useState<ProbeRun>()
  const initialTime = initialFactors.aura ? Math.max(0, initialFactors.auraOnset - 1) : 0
  const [position, setPosition] = useState(initialTime)
  const [playing, setPlaying] = useState(true)
  const [visible, setVisible] = useState(true)
  const [reduced, setReduced] = useState(false)
  const [completed, setCompleted] = useState<number[]>([])
  const clock = useRef(initialTime)
  const { settings, aura, spark, onset, factors } = inputs
  const untreatedEpisode = useMemo(() => compareEpisode({
    trigger: options.initialTrigger,
    factors: { ...initialFactors, ...factors, aura },
  }), [options.initialTrigger, initialFactors, factors, aura])
  const timing = stationTimes(untreatedEpisode, initialFactors.auraOnset, aura)
  const configuredDose = Number.isFinite(options.initialFactors?.start) ? initialFactors.start : timing.binding + bindingLead
  const defaultDose = Math.round(configuredDose / STEP) * STEP
  const earliestDose = Math.min(defaultDose, Math.floor(untreatedEpisode.firstRelease / STEP) * STEP)
  const latestDose = Math.max(defaultDose, Math.min(DURATION - 6, Math.ceil((untreatedEpisode.lastRelease + 4) / STEP) * STEP))
  const exposure = Math.max(earliestDose, Math.min(latestDose, scheduledDose ?? defaultDose))
  const replayStart = Math.max(0, exposure - bindingLead)

  const episode = useMemo(() => compareTreatment(untreatedEpisode, treatment, exposure),
    [untreatedEpisode, treatment, exposure])
  const triptan = useMemo(() => {
    if (!sameTime) return
    const run = compareTreatment(untreatedEpisode, 'sumatriptan', exposure)
    const frames = simulatePainPathway(run.treated, settings, run.factors)
    return {
      treatment: 'sumatriptan' as const,
      exposure,
      samples: run.treated.map((sample, i) => ({ ...sample, headache: frames[i].headache })),
      frames,
      engagement: run.factors.engagement,
    }
  }, [sameTime, untreatedEpisode, exposure, settings])
  const cortex = useMemo(() => simulateCortex(settings, aura, onset, spark),
    [settings.brainState, settings.cleanup, settings.energy, settings.glutamate, settings.interneuron, settings.nmda, settings.nmdaBlock, settings.sparkStrength, aura, onset, spark])
  const pain = useMemo(() => simulatePainPathway(episode.treated, settings, episode.factors), [episode, settings])
  const untreatedPain = useMemo(() => simulatePainPathway(untreatedEpisode.baseline, settings, untreatedEpisode.factors), [untreatedEpisode, settings])
  const { meninges, relay, thalamus } = timing
  const recoveryPathway = useMemo(() => ({
    times: { meninges, relay, thalamus },
    untreated: untreatedPain,
    treated: pain,
  }), [meninges, relay, thalamus, untreatedPain, pain])
  const untreatedRecovery = useMemo(() => untreatedEpisode.baseline.map((sample, i) => ({ ...sample, headache: untreatedPain[i].headache })),
    [untreatedEpisode, untreatedPain])
  const recoveryEpisode = useMemo(() => ({
    ...episode,
    baseline: untreatedRecovery,
    treated: episode.treated.map((sample, i) => ({ ...sample, headache: pain[i].headache })),
  }), [episode, untreatedRecovery, pain])
  // Compare treatment against the same attack and downstream settings.
  const pinned = pinnedRun?.reference === untreatedEpisode && pinnedRun.settings === settings ? pinnedRun : undefined
  const extraTreatment = triptan ?? pinned
  const comparisonStart = Math.max(0, Math.min(exposure, extraTreatment?.exposure ?? exposure) - bindingLead)
  const bindingStart = replayingTreatment ? comparisonStart : timing.binding
  const recoveryTime = useMemo(() => {
    const boundAt = treatmentTargetTime(exposure, episode.factors.engagement)
    const weaker = episode.treated.find((sample, i) => sample.time >= boundAt && untreatedEpisode.baseline[i].cgrpSignal - sample.cgrpSignal >= .05)
    const releaseEnds = Math.min(episode.lastRelease, boundAt + 5)
    return Math.min(DURATION - STEP, Math.max(bindingStart + 3, boundAt + 2.5, weaker?.time ?? 0, releaseEnds))
  }, [episode, exposure, bindingStart, untreatedEpisode])
  const starts: Record<View, number> = { ...timing, binding: bindingStart, recovery: recoveryTime }
  const guidedView = replayingTreatment
    ? (position >= recoveryTime ? 'recovery' : 'binding')
    : steps.reduce<View>((active, step) => position >= starts[step.id] ? step.id : active, 'cortex')
  const view = inspection ?? guidedView
  const microscopeStart = position < bindingStart ? comparisonStart : bindingStart
  const viewIndex = steps.findIndex(step => step.id === view)
  const station = stations.find(item => item.id === view)
  const nextStep = steps[viewIndex + 1]
  const receptorZoom = !reduced && !inspection && view === 'thalamus' && position >= timing.binding - bindingApproach
    ? (position - timing.binding + bindingApproach) / bindingApproach : undefined
  const hostRate = Number.isFinite(options.playbackRate) ? Math.max(.5, Math.min(24, options.playbackRate!)) : rates[view]
  const comparePulses = view === 'recovery' && position < episode.lastRelease + 8
  const waitingForTreatment = view === 'binding' && position < replayStart &&
    (!extraTreatment || position < comparisonStart || position > treatmentTargetTime(extraTreatment.exposure, extraTreatment.engagement) + 1)
  const rate = waitingForTreatment ? Math.max(hostRate, 4) :
    receptorZoom !== undefined || comparePulses ? Math.min(hostRate, 1.6) : hostRate
  const run = useMemo(() => ({ cortex, pain, changedAt: 0 }), [cortex, pain])

  useEffect(() => {
    if (pinnedRun && !pinned) setPinnedRun(undefined)
  }, [pinnedRun, pinned])

  useEffect(() => {
    if (focusStep.current !== view) return
    focusStep.current = undefined
    const heading = stagePanel.current?.querySelector<HTMLElement>('h2, h3')
    if (sameTime) {
      heading?.focus({ preventScroll: true })
      heading?.scrollIntoView({ block: 'start', behavior: 'instant' })
      return
    }
    tabs.current[viewIndex]?.focus({ preventScroll: true })
    heading?.scrollIntoView({ block: 'nearest' })
  }, [view, viewIndex, sameTime])

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(progressKey) ?? '[]')
      if (Array.isArray(saved)) setCompleted(saved.filter(value => Number.isInteger(value) && value >= 0 && value < pathwayExperiments.length))
    } catch {
      // The experiments also work without browser storage.
    }
  }, [])

  useEffect(() => {
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => setVisible(entries[0].isIntersecting))
    if (panel.current) observer?.observe(panel.current)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    function update() {
      setReduced(motion.matches)
      if (motion.matches) setPlaying(false)
    }
    if (motion.matches) {
      clock.current = Math.min(timing.meninges - STEP, onset + 3.5)
      setPosition(clock.current)
    }
    update()
    motion.addEventListener('change', update)
    return () => {
      observer?.disconnect()
      motion.removeEventListener('change', update)
    }
  }, [])

  useEffect(() => {
    if (!playing || !visible) return
    let handle = 0
    let last = 0
    function tick(now: number) {
      const delta = last ? Math.min(100, now - last) : 0
      last = now
      if (!document.hidden) {
        clock.current = Math.min(DURATION, clock.current + delta * rate / 1000)
        setPosition(clock.current)
        if (clock.current >= DURATION) {
          setPlaying(false)
          return
        }
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [playing, visible, rate])

  const index = Math.min(cortex.length - 1, Math.floor(position / STEP))
  const frame = cortex[index]
  const response = pain[index]
  const sample = episode.treated[index]
  const recoverySample = view === 'recovery' ? sampleBetween(recoveryEpisode.treated, position) : undefined
  const atProbe = frame.cells[probe]
  const auraVisible = aura && frame.crossed > 0 && frame.active > 0
  let leftmostWave = CORTEX_COLUMNS
  let rightmostWave = 0
  if (auraVisible && station) {
    const nextFrame = cortex[Math.min(index + 1, cortex.length - 1)]
    frame.cells.forEach((cell, cellIndex) => {
      if (cell.state !== 'wave' && nextFrame.cells[cellIndex].state !== 'wave') return
      const ignitedAt = nextFrame.cells[cellIndex].ignitedAt
      if (ignitedAt > position) return
      const span = unit((position - ignitedAt) / STEP)
      const column = cellIndex % CORTEX_COLUMNS
      leftmostWave = Math.min(leftmostWave, column + 1 - span)
      rightmostWave = Math.max(rightmostWave, column + span)
    })
  }
  const visualSample = {
    ...sample,
    auraFront: auraVisible ? rightmostWave / CORTEX_COLUMNS : 0,
    auraWake: auraVisible ? leftmostWave / CORTEX_COLUMNS : 1,
    lightSensitivity: 0,
  }
  const readouts = [
    ['Tissue crossed', asLevel(frame.crossed), '%'],
    ['Free CGRP', asLevel(response.cgrp), '/ 100'],
    ['Relay output', asLevel(response.relay), '/ 100'],
    ['Thalamic output', asLevel(response.thalamus), '/ 100'],
    ['CGRP cell signal', asLevel(sample.cgrpSignal), '/ 100'],
    ['Head pain', asLevel(response.headache), '/ 100'],
  ] as const
  const stationStates = [
    !aura ? 'Aura off' : frame.active > 0 ? 'Wave spreading' : frame.crossed > 0 ? 'After the wave' : 'Resting',
    response.release > .02 ? 'Releasing CGRP' : response.cgrp > .02 ? 'CGRP clearing' : 'Quiet',
    response.relayGain > 1.15 ? 'Sensitised' : response.relay > .02 ? 'Passing signal' : 'Quiet',
    response.lightDrive > .02 ? 'Light adds drive' : response.thalamus > .02 ? 'Passing pain signal' : 'Quiet',
    position <= exposure ? 'Before treatment' : position < treatmentTargetTime(exposure, episode.factors.engagement) ? 'Drug approaching' : 'Compare signals',
    position < recoveryTime ? 'After binding' : 'Compare both runs',
  ] as const

  function moveTo(time: number) {
    clock.current = time
    setPosition(time)
  }

  function snapshot() {
    setPrevious({ ...run, changedAt: position })
    setInspection(view)
  }

  function updateSetting<K extends keyof PathwaySettings>(key: K, value: PathwaySettings[K]) {
    snapshot()
    setInputs(current => ({ ...current, settings: { ...current.settings, [key]: value } }))
  }

  function change(control: PathwayControl, value: number, number: number) {
    setSelected(number)
    if (isFactor(control.key)) {
      const key = control.key
      snapshot()
      setInputs(current => ({ ...current, factors: { ...current.factors, [key]: value } }))
      return
    }
    if (view === 'cortex') setPreset('custom')
    updateSetting(control.key, value)
  }

  function changeTreatment(next: BindingDrug) {
    setTreatment(next)
    if (view === 'recovery') scrub(position)
    else playFromTreatment(playing)
  }

  function changeExposure(next: number) {
    setScheduledDose(next)
    setInspection(view)
    setPlaying(false)
  }

  function openTreatmentComparison() {
    focusStep.current = 'recovery'
    setSameTime(true)
    setInspection('recovery')
    const keepMoment = (view === 'binding' || view === 'recovery') && position < DURATION
    if (!keepMoment) {
      moveTo(replayStart)
    }
    setPlaying(!reduced && (!keepMoment || playing))
  }

  function openTreatmentTiming() {
    focusStep.current = 'recovery'
    setSameTime(false)
    scrub(position)
  }

  function pinTreatment() {
    setPinnedRun({
      reference: untreatedEpisode,
      settings,
      treatment,
      exposure,
      samples: recoveryEpisode.treated,
      frames: pain,
      engagement: episode.factors.engagement,
    })
  }

  function playFromTreatment(shouldPlay = !reduced) {
    setReplayingTreatment(true)
    setInspection(undefined)
    moveTo(comparisonStart)
    setPlaying(shouldPlay)
  }

  function reset() {
    setPrevious(undefined)
    setReplayingTreatment(false)
    setInspection(undefined)
    setScale('Whole cortex')
    setInputs(current => ({ ...current, onset: initialFactors.auraOnset }))
    moveTo(reduced ? Math.min(timing.meninges - STEP, initialFactors.auraOnset + 3.5) : initialTime)
    setPlaying(!reduced)
  }

  function visit(next: View, inspect = next !== 'binding' && next !== 'recovery', beginZoom = false) {
    const nextIndex = steps.findIndex(step => step.id === next)
    const following = steps[nextIndex + 1]
    const end = following ? starts[following.id] : DURATION
    if (nextIndex < stations.length || beginZoom) setReplayingTreatment(false)
    if (beginZoom && !reduced && playing && position < timing.binding) {
      moveTo(Math.max(timing.binding - bindingApproach, position))
    } else if (position < starts[next] || position >= end) {
      moveTo(next === 'cortex' ? initialTime : beginZoom ? timing.binding : starts[next])
    }
    setInspection(inspect ? next : undefined)
    setSelected(1)
  }

  function replayRecovery() {
    setInspection('recovery')
    moveTo(comparisonStart)
    setPlaying(!reduced)
  }

  function togglePlayback() {
    if (position >= DURATION) {
      if (view === 'recovery') {
        setInspection('recovery')
        moveTo(extraTreatment ? comparisonStart : recoveryTime)
        setPlaying(true)
        return
      }
      if (!inspection) {
        if (replayingTreatment) {
          playFromTreatment(true)
          return
        }
        reset()
        setPlaying(true)
        return
      }
      moveTo(starts[view])
    }
    setPlaying(value => !value)
  }

  function scrub(time: number) {
    setInspection(view)
    setPlaying(false)
    moveTo(time)
  }

  function nextMoment() {
    setPlaying(false)
    const moments = [...playbackMoments, ...Object.values(starts), exposure, treatmentTargetTime(exposure, episode.factors.engagement)]
    if (extraTreatment) moments.push(extraTreatment.exposure, treatmentTargetTime(extraTreatment.exposure, extraTreatment.engagement))
    moveTo(Math.min(...moments.filter(moment => moment > position + STEP / 2), DURATION))
  }

  function holdOnFocus(event: FocusEvent<HTMLElement>) {
    if (receptorZoom === undefined && (event.target.matches(':focus-visible') || event.target instanceof SVGElement)) setInspection(view)
  }

  function advance(next: View) {
    focusStep.current = next
    visit(next, false, next === 'binding')
  }

  function inspectOnMap(next: Station | 'binding') {
    if (next === 'binding') advance(next)
    else visit(next)
  }

  function showEvidence(event: MouseEvent<HTMLAnchorElement>) {
    if (!evidence.current) return
    event.preventDefault()
    setInspection(view)
    evidence.current.open = true
    evidence.current.scrollIntoView({ block: 'nearest' })
    evidence.current.querySelector('summary')?.focus({ preventScroll: true })
  }

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    const last = steps.length - 1
    const offset = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : offset ? (viewIndex + offset + steps.length) % steps.length : undefined
    if (next === undefined) return
    event.preventDefault()
    visit(steps[next].id)
    tabs.current[next]?.focus()
  }

  function recordExperiment(index: number) {
    const next = completed.includes(index) ? completed.filter(value => value !== index) : [...completed, index]
    setCompleted(next)
    try {
      window.localStorage.setItem(progressKey, JSON.stringify(next))
    } catch {
      // The checkmark stays available for the current visit.
    }
  }

  function placeCell(cell: number) {
    setCursor(cell)
    setInspection('cortex')
    if (tool === 'probe') {
      setProbe(cell)
      return
    }
    snapshot()
    const newOnset = Math.min(position, DURATION - 12)
    setInputs(current => ({ ...current, spark: cell, onset: newOnset }))
    moveTo(newOnset)
    if (!reduced) setPlaying(true)
  }

  function shortcut(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault()
      setPlaying(false)
      return
    }
    if (sameTime || target.matches('input, textarea, button')) return
    if (event.key === '[' || event.key === ']') {
      event.preventDefault()
      visit(steps[(viewIndex + (event.key === ']' ? 1 : steps.length - 1)) % steps.length].id)
    }
    if (view === 'cortex' && scale === 'Tissue patch' && (event.key === '1' || event.key === '2')) {
      setInspection('cortex')
      setTool(event.key === '1' ? 'poke' : 'probe')
    }
  }

  const measurements = view === 'cortex'
    ? [['Potassium at probe', asLevel(atProbe.potassium) + ' / 100'], ['Probe state', !aura ? 'Aura off' : atProbe.state === 'quiet' ? 'Recovering' : atProbe.state === 'wave' ? 'In the wave' : 'Resting'],
      ['Tissue crossed', asLevel(frame.crossed) + '%']]
    : view === 'meninges'
      ? [['CGRP released', asLevel(response.release) + ' / 100'], ['Free CGRP', asLevel(response.cgrp) + ' / 100'],
        ['Vessel width', Math.round(100 + 55 * response.vessel) + '% of rest']]
      : view === 'relay'
        ? [['Relay output', asLevel(response.relay) + ' / 100'], ['Relay gain', response.relayGain.toFixed(2) + '× rest'],
          ['Response to touch', asLevel(response.touchResponse) + ' / 100']]
        : [['From brainstem', asLevel(response.relay) + ' / 100'], ['Added light drive', asLevel(response.lightDrive) + ' / 100'],
          ['Thalamic output', asLevel(response.thalamus) + ' / 100'], ['Touch beyond head', asLevel(response.touchSpread) + ' / 100']]

  const treatmentControls = <div className="mp-treatment-options">
    {!sameTime && <fieldset className="ml-choices mp-binding-choices">
      <legend>Current treatment</legend>
      {bindingDrugs.map(({ id: value, label, className, target }) => <label key={value}>
        <input type="radio" name={id + '-binding-drug'} checked={treatment === value} onChange={() => changeTreatment(value)} />
        <span><b>{label}</b><small>{className} · {target}</small></span>
      </label>)}
    </fieldset>}
    <TreatmentTiming id={id + '-dose-time'} min={earliestDose} max={latestDose}
      value={exposure} treatment={treatment} pinnedTime={sameTime ? undefined : pinned?.exposure} change={changeExposure}
      onPin={sameTime ? undefined : pinTreatment} onClear={() => {
        setPinnedRun(undefined)
        document.getElementById(id + '-dose-time')?.focus({ preventScroll: true })
      }} />
  </div>

  return <section className="mp-pathway mw-lab" ref={panel} aria-label="Migraine pathway" onKeyDown={shortcut}
    data-station={view} data-time={position.toFixed(2)} data-playing={playing && visible}>
    {(!sameTime || onBack) && <header className="mp-heading">
      <div>
        {onBack && <button className="mp-back" type="button" ref={root} onClick={onBack}>
          <Icon name="arrow" /> Back to head
        </button>}
        <h2>Pathway</h2>
      </div>
      {!sameTime && <div className="mp-playback">
        <div className="mp-clock"><span>Model time</span><output aria-live="off" aria-label="Current model time">{position.toFixed(1)}</output></div>
        <button type="button" onClick={togglePlayback}>
          <Icon name={playing ? 'pause' : 'play'} />{playing ? 'Pause' : 'Play'}
        </button>
        {inspection && <button type="button" onClick={() => setInspection(undefined)}>Follow sequence</button>}
        {reduced && <button type="button" onClick={nextMoment} disabled={position >= DURATION}>Next moment</button>}
        <button className="mp-restart" type="button" onClick={reset}><Icon name="reset" /> Restart</button>
      </div>}
    </header>}

    {!sameTime && <div className="mp-compare-action">
      <button type="button" onClick={openTreatmentComparison}><Icon name="receptor" /> Compare sumatriptan and ubrogepant</button>
    </div>}

    {!sameTime && <div className="mp-station-nav" role="tablist" aria-label="Pathway steps" onKeyDown={navigateTabs}>
      {steps.map(({ id: key, name }, i) => <div key={key} className="mp-station-tab" role="presentation">
        {i > 0 && <span className="mp-station-connector" data-uncertain={i === 1} aria-hidden="true" />}
        <button type="button" role="tab" id={id + '-tab-' + key} aria-controls={id + '-stage'} aria-selected={view === key}
          aria-label={name} ref={node => { tabs.current[i] = node }} tabIndex={view === key ? 0 : -1}
          data-comparison={i >= stations.length} data-quiet={key === 'cortex' && !aura} onClick={() => visit(key)}>
          <span><i aria-hidden="true">{i + 1}</i><b>{name}</b></span>
          <meter min={0} max={100} value={readouts[i][1]} aria-label={readouts[i][0]} />
          <small><span>{stationStates[i]}</span><span>{readouts[i][1]}{readouts[i][2] === '%' ? '%' : ' / 100'}</span></small>
        </button>
      </div>)}
    </div>}
    <div ref={stagePanel} id={id + '-stage'} role={sameTime ? undefined : 'tabpanel'}
      aria-labelledby={sameTime ? undefined : id + '-tab-' + view} tabIndex={sameTime ? undefined : 0} onFocus={holdOnFocus}>
      {station && <>
        <div className="mp-station-layout">
          <PathwayHeadMap id={id} view={receptorZoom === undefined ? station.id : 'binding'} sample={visualSample} time={position}
            frames={pain} times={timing} aura={aura} zoom={receptorZoom} onInspect={inspectOnMap} onEvidence={showEvidence} />
          <div className="mp-stage-area">
            <div className="mp-stage-heading">
              <div><h3>{station.name}</h3><p>{station.question}</p></div>
              <button type="button" className="mp-next" aria-label={'Continue to ' + nextStep.name} onClick={() => advance(nextStep.id)}>
                {nextStep.name} <Icon name="arrow" size={15} />
              </button>
            </div>
            {station.id === 'cortex' && <div className="mp-scales" aria-label="Cortex scale">
              {cortexScales.map(next => <button type="button" key={next} aria-pressed={scale === next} onClick={() => {
                setInspection('cortex')
                setScale(next)
              }}>{next}</button>)}
            </div>}
            <div className="mp-stage-frame" key={station.id} data-zooming={receptorZoom !== undefined}>
              {station.id !== 'cortex' ? <PainStage station={station.id} frame={response} sample={sample} episode={episode} settings={settings} selected={selected} />
                : scale === 'Whole cortex' ? <div className="mp-whole">
                  <figure><MigraineVision id={id + '-cortex-vision'} sample={visualSample} enabled={aura} /><figcaption>Her vision</figcaption></figure>
                </div> : scale === 'One synapse' ? <SynapseStage frame={frame} probe={probe} selected={selected} blocked={settings.nmdaBlock} />
                  : <CortexStage frame={frame} probe={probe} spark={spark} cursor={cursor} selected={selected} onCell={placeCell} onMove={setCursor} tool={tool} />}
            </div>
            {station.id === 'cortex' && scale === 'Tissue patch' && <div className="mp-stage-tools">
              <button type="button" aria-pressed={tool === 'poke'} onClick={() => setTool('poke')}><Icon name="plus" /> Poke</button>
              <button type="button" aria-pressed={tool === 'probe'} onClick={() => setTool('probe')}><Icon name="crosshair" /> Place probe</button>
              <span>{tool === 'poke' ? 'Choose a cell to start a new wave.' : 'Choose a cell to record its activity.'}</span>
            </div>}
            {station.id === 'cortex' && scale !== 'Whole cortex' && <div className="mp-stage-key"><span><i className="mp-key-potassium" /> Potassium</span><span><i className="mp-key-glutamate" /> Glutamate</span>
              <span><i className="mp-key-quiet" /> Recovering cell</span></div>}
          </div>
          <fieldset className="mp-biology">
            <legend>Biology at this station</legend>
            {station.id === 'cortex' && <div className="mp-presets" role="group" aria-label="Cortex presets">
              {(Object.keys(cortexPresets) as Preset[]).map(next => <button key={next} type="button" aria-pressed={preset === next} onClick={() => {
                snapshot()
                setPreset(next)
                setInputs(current => ({ ...current, settings: { ...current.settings, ...cortexPresets[next].values } }))
              }}>{cortexPresets[next].label}</button>)}
            </div>}
            {station.controls.map((control, i) => <NumberControl key={control.key} id={id + '-' + control.key} number={i + 1} control={control}
              focused={selected === i + 1} value={isFactor(control.key) ? factors[control.key] : settings[control.key]}
              select={() => setSelected(i + 1)} change={value => change(control, value, i + 1)} />)}
            {station.id === 'cortex' && scale === 'Tissue patch' && <NumberControl id={id + '-spark-strength'}
              control={{ key: 'sparkStrength', label: 'Poke strength', effect: 'Sets the size of the local disturbance when you poke.' }}
              value={settings.sparkStrength} change={value => updateSetting('sparkStrength', value)} />}
            {station.id === 'cortex' && <label className="mp-treatment-switch"><input type="checkbox" checked={settings.nmdaBlock}
              onChange={event => updateSetting('nmdaBlock', event.currentTarget.checked)} /> Reduce NMDA signalling</label>}
            {station.id === 'thalamus' && <label className="mp-treatment-switch"><input type="checkbox" checked={settings.darkRoom}
              onChange={event => updateSetting('darkRoom', event.currentTarget.checked)} /> Dark room</label>}
          </fieldset>
          <div className="mp-lesson">
            <dl>{measurements.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <p>{station.lesson}</p>
          </div>
        </div>

        <aside className="mp-felt" aria-label="Felt as"><strong>Felt as</strong>
          <span>{auraVisible ? 'Visual aura' : 'No visual aura'}</span>
          <span>Modeled head pain <output aria-live="off">{asLevel(response.headache)} / 100</output></span>
          <span>{response.lightDrive >= .03 ? 'Light adds to pain' : 'Little added pain from light'}</span>
          <span>{response.touchResponse >= .08 ? 'Scalp touch is amplified' : 'Little response to test touch'}</span>
        </aside>
        <div className="mp-global">
          <NumberControl id={id + '-brain-state'} control={{ key: 'brainState', label: 'Brain state', effect: 'Higher values make the wave easier to start and weaken the modeled brake.' }}
            value={settings.brainState} change={value => updateSetting('brainState', value)} />
          <fieldset className="mp-aura">
            <legend>Attack type</legend>
            {[true, false].map(value => <label key={String(value)}>
              <input type="radio" name={id + '-attack'} checked={aura === value} onChange={() => {
                snapshot()
                setInputs(current => ({ ...current, aura: value }))
              }} /> {value ? 'With aura' : 'Without aura'}
            </label>)}
          </fieldset>
        </div>
        <PathwayTraces id={id} run={run} previous={previous} probe={probe} time={position} aura={aura} />
        <div className="mp-timeline"><label htmlFor={id + '-time'}>Model time</label>
          <input id={id + '-time'} type="range" min={0} max={DURATION} step={STEP} value={Math.round(position / STEP) * STEP}
            onChange={event => scrub(event.currentTarget.valueAsNumber)} />
          <output htmlFor={id + '-time'}>{position.toFixed(1)} / {DURATION}</output>
        </div>
      </>}
      {view === 'binding' && <div className="mp-comparison" data-pinned={Boolean(extraTreatment)}>
        <ReceptorMicroscope id={id + '-binding'} episode={episode} controlEpisode={untreatedEpisode} exposure={exposure}
          sample={sampleBetween(episode.treated, position)} control={sampleBetween(untreatedEpisode.baseline, position)}
          time={position} end={DURATION} playing={playing} pinned treatedPin={false} canApplyNow={false}
          canAttack={episode.triggerInput * 100 > episode.factors.threshold}
          autoZoomStart={reduced ? undefined : microscopeStart}
          showTreatmentTime
          pinnedTreatment={pinned}
          onRecovery={() => advance('recovery')} onWatch={() => playFromTreatment()} onScrub={scrub}
          onPlay={extraTreatment ? togglePlayback : undefined}
          choices={treatmentControls} />
      </div>}
      {recoverySample && <div className="mp-comparison" data-pinned={Boolean(extraTreatment)}>
        <HeadRecovery id={id + '-recovery'} episode={recoveryEpisode}
          sample={recoverySample} control={sampleBetween(recoveryEpisode.baseline, position)}
          nerve={recoverySample} time={position} end={DURATION} playing={playing}
          pathway={recoveryPathway}
          exposure={exposure} treatmentControls={treatmentControls} pinnedTreatment={extraTreatment} sameTime={sameTime} onPlay={togglePlayback}
          onStep={sameTime && reduced ? nextMoment : undefined}
          onReplayTreatment={extraTreatment ? replayRecovery : () => {
            focusStep.current = 'binding'
            playFromTreatment()
          }}
          onBinding={sameTime ? openTreatmentTiming : () => { focusStep.current = 'binding'; visit('binding') }}
          onScrub={scrub} />
      </div>}
    </div>
    <div className="mp-notes">
      <details><summary>Experiments to try <span>{completed.length} of {pathwayExperiments.length}</span></summary>
        <ul className="mp-experiments">{pathwayExperiments.map((task, index) =>
          <li key={task}><label><input type="checkbox" checked={completed.includes(index)} onChange={() => recordExperiment(index)} /> {task}</label></li>)}</ul>
      </details>
      <details id={id + '-evidence'} ref={evidence}><summary>How sure is each link?</summary>
        <p>The head map projects deeper structures onto a side cutaway. Activity, concentrations and time use model units. Each setting change recalculates the run and keeps the previous traces for comparison.</p>
        <ul className="mp-evidence">{pathwayEvidence.map(item => <li key={item.id}>
          <div><strong>{item.title}</strong><small data-debated={item.id === 'link'}>{item.level}</small></div>
          <p>{item.description} <a href={item.url} target="_blank" rel="noreferrer">{item.source}</a></p>
        </li>)}</ul>
      </details>
    </div>
  </section>
}
