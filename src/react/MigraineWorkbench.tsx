import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  compareEpisode, createFactors, episodePhase, findTreatment, isAuraActive, treatmentEffectTime, treatmentStart,
  type EpisodeComparison, type Factors, type Intervention, type NumericFactor,
} from '../core/index.js'
import type { MigraineLabProps } from './MigraineLab.js'
import { HeadCutaway, type AnatomyView } from './HeadCutaway.js'
import { HeadRecovery } from './HeadRecovery.js'
import { Icon } from './icon.js'
import { MigrainePathway } from './MigrainePathway.js'
import { MigraineViews } from './MigraineViews.js'
import { ReceptorMicroscope } from './ReceptorMicroscope.js'
import { sampleBetween, workbenchDuration, workbenchTraces } from './workbench-episode.js'

const sliders = [
  { key: 'intensity', label: 'Trigger intensity', hint: 'Changes how strongly the nerve responds.' },
  { key: 'sensitivity', label: 'Sensitivity', hint: 'Changes the response to the same trigger.' },
  { key: 'recoverySpeed', label: 'Recovery speed', hint: 'Changes how long symptoms linger.' },
] satisfies readonly { key: NumericFactor; label: string; hint: string }[]

const affectedViews = {
  intensity: ['nerve', 'vessel', 'vision', 'receptor', 'symptoms'],
  sensitivity: ['nerve', 'vessel', 'vision', 'receptor', 'symptoms'],
  recoverySpeed: ['vision', 'symptoms'],
  aura: ['brain', 'vision'],
  treatment: ['vessel', 'vision', 'receptor', 'symptoms'],
} as const satisfies Record<string, readonly AnatomyView[]>

type Control = keyof typeof affectedViews
type TreatmentChoice = 'none' | 'ubrogepant' | 'galcanezumab'
const treatmentChoices = [
  ['none', 'None'],
  ['ubrogepant', 'Ubrogepant · acute'],
  ['galcanezumab', 'Galcanezumab · preventive'],
] as const
type PinnedRun = { episode: EpisodeComparison; traces: ReturnType<typeof workbenchTraces>; end: number }

const statusText = {
  Ready: 'The episode is starting.',
  'Below threshold': 'The trigger load is too low to start an attack.',
  Trigger: 'The first nerve pulse is about to start.',
  Aura: 'The wave in the visual cortex is spreading.',
  Attack: 'The nerve is releasing chemical messengers.',
  Recovery: 'The nerve has quieted and symptoms are fading.',
  Settled: 'The modeled episode has settled.',
} as const

function defaultTreatment(treatment: MigraineLabProps['initialTreatment']): TreatmentChoice {
  return treatment === 'ubrogepant' || treatment === 'galcanezumab' ? treatment : 'none'
}

function inspectionTime(episode: EpisodeComparison) {
  if (episode.triggerInput * 100 <= episode.factors.threshold) return 0
  const pulse = episode.firstPeak + 2.5
  return episode.factors.aura ? Math.max(pulse, episode.factors.auraOnset + 4) : pulse
}

export function MigraineWorkbench({ options, active, exploreId, onExplore }: {
  options: MigraineLabProps
  active: boolean
  exploreId: string
  onExplore: () => void
}) {
  const id = useId()
  const root = useRef<HTMLElement>(null)
  const instrument = useRef<HTMLDivElement>(null)
  const bindingOpener = useRef<HTMLButtonElement>(null)
  const bindingBack = useRef<HTMLButtonElement>(null)
  const recoveryBack = useRef<HTMLButtonElement>(null)
  const pathwayBack = useRef<HTMLButtonElement>(null)
  const pathwayOpener = useRef<HTMLButtonElement>(null)
  const clock = useRef(0)
  const loopHold = useRef(0)
  const adjustmentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [factors, setFactors] = useState(() => createFactors({ aura: true, ...options.initialFactors }, options.initialTreatment))
  const [treatment, setTreatment] = useState<TreatmentChoice>(() => defaultTreatment(options.initialTreatment))
  const [appliedAt, setAppliedAt] = useState<number>()
  const [pinned, setPinned] = useState<PinnedRun>()
  const [focused, setFocused] = useState<AnatomyView>()
  const [zoom, setZoom] = useState<CSSProperties>()
  const [binding, setBinding] = useState<CSSProperties>()
  const [followBinding, setFollowBinding] = useState<Intervention>()
  const [recoveryStart, setRecoveryStart] = useState<number>()
  const [pathway, setPathway] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [repeat, setRepeat] = useState(true)
  const [adjusting, setAdjusting] = useState<Control>()
  const [reduced, setReduced] = useState(false)
  const [visible, setVisible] = useState(true)
  const [position, setPositionState] = useState(0)

  const trigger = options.initialTrigger ?? 'weather'
  const treatmentFactors = useMemo(() => ({ ...factors,
    start: treatment === 'galcanezumab' ? 0 : options.initialFactors?.start ?? appliedAt ?? factors.start,
    engagement: options.initialFactors?.engagement ?? (treatment === 'ubrogepant' ? 1.8 : factors.engagement),
  }), [factors, treatment, appliedAt, options.initialFactors?.start, options.initialFactors?.engagement])
  const episode = useMemo(() => compareEpisode({ trigger, factors: treatmentFactors, treatment, treatmentAppliedAt: appliedAt }),
    [trigger, treatmentFactors, treatment, appliedAt])
  const initialInspectionTime = useRef(inspectionTime(episode))
  const currentEnd = useMemo(() => workbenchDuration(episode), [episode])
  const traces = useMemo(() => workbenchTraces(episode), [episode])
  const effectTime = useMemo(() => {
    if (treatment === 'none') return undefined
    const moment = treatmentEffectTime(episode)
    const change = sampleBetween(episode.baseline, moment).cgrpSignal - sampleBetween(episode.treated, moment).cgrpSignal
    return change >= .01 ? moment : undefined
  }, [episode, treatment])
  const end = Math.max(currentEnd, pinned?.end ?? 0)
  const time = Math.min(position, end)
  const untreated = sampleBetween(episode.baseline, time)
  const current = sampleBetween(episode.treated, time)
  const canAttack = episode.triggerInput * 100 > factors.threshold
  const pinnedFrame = pinned && {
    sample: sampleBetween(pinned.episode.treated, time),
    nerve: sampleBetween(pinned.episode.baseline, time),
    treatment: pinned.episode.treatment,
    traces: pinned.traces,
    canAttack: pinned.episode.triggerInput * 100 > pinned.episode.factors.threshold,
  }
  const settled = time >= end
  const modeledPhase = episodePhase(episode, current)
  const betweenPulses = modeledPhase === 'Attack' && time > episode.firstPeak && time < episode.firstRelease + factors.gap && current.releasedCgrp + current.releasedPacap < 0.025
  const phase = settled && canAttack && modeledPhase !== 'Settled' ? 'End of run' : betweenPulses ? 'Between pulses' : modeledPhase
  const running = active && visible && playing && !pathway
  const highlighted = adjusting ? affectedViews[adjusting] : []
  const intervention = findTreatment(treatment)
  const exposure = Math.max(episode.factors.start, episode.treatmentAppliedAt ?? 0)
  const canApplyNow = canAttack && Math.max(time, options.initialFactors?.start ?? 0) < episode.lastRelease - 1.5
  const bindingControl = pinned?.episode ?? episode
  const control = binding || recoveryStart !== undefined ? sampleBetween(bindingControl.baseline, time) : undefined
  const { playbackRate = 3.6 } = options
  const rate = Number.isFinite(playbackRate) ? Math.max(0.5, Math.min(24, playbackRate)) : 3.6
  const bindingHandoff = useMemo(() => {
    const boundAt = exposure + episode.factors.engagement * 1.25
    if (treatment === 'none' || !canAttack || episode.factors.strength === 0 || boundAt >= end - 0.25) return undefined
    const signalDrop = episode.treated.find((sample, index) =>
      sample.time >= boundAt && episode.baseline[index].cgrpSignal - sample.cgrpSignal >= 0.05)
    const showBindingUntil = boundAt + Math.min(4, rate * 0.85)
    return Math.min(end - 0.25, Math.max(showBindingUntil, signalDrop?.time ?? boundAt))
  }, [episode, exposure, end, rate, treatment, canAttack])
  const showingRecovery = !binding && recoveryStart !== undefined
  const overview = !binding && !showingRecovery
  const shouldRepeat = repeat && recoveryStart === undefined

  useEffect(() => {
    if (!pathway) return
    pathwayBack.current?.focus({ preventScroll: true })
    pathwayBack.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  }, [pathway])

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches) {
      clock.current = initialInspectionTime.current
      setPositionState(clock.current)
    }
    function sync() {
      setReduced(motion.matches)
      if (motion.matches) setPlaying(false)
    }
    sync()
    motion.addEventListener('change', sync)
    return () => motion.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting))
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => {
    clearTimeout(adjustmentTimer.current)
    clearTimeout(zoomTimer.current)
  }, [])

  useEffect(() => {
    if (!active || pathway) return
    if (!binding && !showingRecovery) {
      if (zoom || !bindingOpener.current) return
      const opener = bindingOpener.current
      bindingOpener.current = null
      opener.focus({ preventScroll: true })
      opener.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      return
    }
    const back = showingRecovery ? recoveryBack : bindingBack
    back.current?.focus({ preventScroll: true })
    const box = instrument.current?.getBoundingClientRect()
    if (box && (box.top < 0 || box.top > window.innerHeight * .58)) {
      instrument.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }, [binding, showingRecovery, zoom, active, pathway])

  useEffect(() => {
    if (!running || !binding || followBinding !== treatment || bindingHandoff === undefined || time < bindingHandoff) return
    setFollowBinding(undefined)
    setRecoveryStart(time)
    setBinding(undefined)
  }, [running, binding, followBinding, treatment, bindingHandoff, time])

  useEffect(() => {
    if (clock.current <= end) return
    clock.current = end
    loopHold.current = 0
    setPositionState(end)
  }, [end])

  useEffect(() => {
    if (!running) return
    let frame = 0
    let previous: number | undefined
    function tick(now: number) {
      const delta = previous === undefined ? 0 : Math.min(100, now - previous) / 1000
      previous = now
      if (!document.hidden) {
        if (clock.current < end) {
          loopHold.current = 0
          clock.current = Math.min(end, clock.current + delta * rate)
          setPositionState(clock.current)
        } else if (!shouldRepeat) {
          setPlaying(false)
          return
        } else {
          loopHold.current += delta
          if (loopHold.current >= 1.25) {
            clock.current = 0
            loopHold.current = 0
            setPositionState(0)
          }
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running, rate, end, shouldRepeat])

  function setPosition(next: number) {
    clock.current = next
    loopHold.current = 0
    setPositionState(next)
  }

  function reset() {
    const defaults = createFactors({ aura: true, ...options.initialFactors }, options.initialTreatment)
    setFactors(defaults)
    setTreatment(defaultTreatment(options.initialTreatment))
    setAppliedAt(undefined)
    setPinned(undefined)
    setFocused(undefined)
    setPlaying(!reduced)
    setRepeat(true)
    setAdjusting(undefined)
    clearTimeout(adjustmentTimer.current)
    clearTimeout(zoomTimer.current)
    bindingOpener.current = null
    setZoom(undefined)
    setBinding(undefined)
    setFollowBinding(undefined)
    setRecoveryStart(undefined)
    setPosition(reduced ? inspectionTime(compareEpisode({ trigger, factors: defaults })) : 0)
  }

  function markAdjustment(control: Control) {
    clearTimeout(adjustmentTimer.current)
    setAdjusting(control)
    adjustmentTimer.current = setTimeout(() => setAdjusting(undefined), 2400)
  }

  function changeTreatment(next: TreatmentChoice) {
    setTreatment(next)
    setAppliedAt(!settled && next === 'ubrogepant' ? time : undefined)
    if (next === 'none') {
      setFollowBinding(undefined)
      setRecoveryStart(undefined)
    } else if (binding && recoveryStart === undefined) {
      if (!pinned) pinUntreated()
      setFollowBinding(next)
    }
    markAdjustment('treatment')
  }

  function pinRun() {
    setPinned({ episode, traces, end: currentEnd })
    setPosition(time)
    setPlaying(false)
  }

  function pinUntreated() {
    const control: EpisodeComparison = {
      ...episode, treatment: 'none', treatmentAppliedAt: undefined, treated: episode.baseline,
    }
    setPinned({ episode: control, traces: workbenchTraces(control), end: currentEnd })
  }

  function togglePlayback() {
    if (settled && !playing) setPosition(recoveryStart !== undefined && recoveryStart < end ? recoveryStart : 0)
    if (binding && recoveryStart === undefined && !playing && bindingHandoff !== undefined && (settled || time < bindingHandoff)) {
      if (!pinned) pinUntreated()
      setFollowBinding(treatment)
    }
    setPlaying(value => !value)
  }

  function watchBinding() {
    if (!pinned) pinUntreated()
    setRecoveryStart(undefined)
    setFollowBinding(treatment === 'none' ? 'ubrogepant' : treatment)
    const missedAttack = treatment === 'ubrogepant' && exposure >= episode.lastRelease
    if (treatment === 'none' || missedAttack) {
      const hostStart = options.initialFactors?.start === undefined ? undefined : factors.start
      const start = hostStart ?? treatmentStart('ubrogepant')
      const replayStart = Math.max(0, Math.min(start, episode.lastRelease - 3))
      const applyNow = !missedAttack && canApplyNow
      setTreatment('ubrogepant')
      setAppliedAt(applyNow ? time : replayStart)
      if (!applyNow) setPosition(Math.min(end, Math.max(0, (hostStart ?? replayStart) - 5)))
    } else {
      const replayAt = treatment === 'ubrogepant' ? exposure - 5 : episode.firstRelease - 2
      setPosition(Math.min(end, Math.max(0, replayAt)))
    }
    markAdjustment('treatment')
    setPlaying(true)
  }

  function openBinding(opener: HTMLButtonElement) {
    if (binding || zoom) return
    setFocused('receptor')
    bindingOpener.current = opener
    if (playing && bindingHandoff !== undefined && time < bindingHandoff) {
      if (!pinned) pinUntreated()
      setFollowBinding(treatment)
    }
    const box = instrument.current?.getBoundingClientRect()
    const head = instrument.current?.querySelector('.mw-head')?.getBoundingClientRect()
    const marker = instrument.current?.querySelector('.mw-anatomy-point[data-view="receptor"] span')?.getBoundingClientRect()
    const anchor = marker && marker.top >= 0 && marker.bottom <= window.innerHeight ? marker : opener.getBoundingClientRect()
    const centerX = anchor.left + anchor.width / 2
    const centerY = anchor.top + anchor.height / 2
    const origin = { transformOrigin: `${centerX - (box?.left ?? 0)}px ${Math.max(0, centerY - (box?.top ?? 0))}px` }
    if (!reduced && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && head && anchor === marker) {
      setZoom({ '--mw-zoom-origin': `${centerX - head.left}px ${centerY - head.top}px` } as CSSProperties)
      zoomTimer.current = setTimeout(() => {
        setZoom(undefined)
        setBinding(origin)
      }, 260)
    } else setBinding(origin)
  }

  function closeBinding() {
    setFollowBinding(undefined)
    setBinding(undefined)
  }

  function showRecovery() {
    if (!pinned) pinUntreated()
    setFollowBinding(undefined)
    setRecoveryStart(time)
    setBinding(undefined)
  }

  function scrub(next: number) {
    setPosition(Math.min(end, next))
    setPlaying(false)
  }

  function inspect(view: AnatomyView, opener: HTMLButtonElement) {
    if (view === 'receptor') {
      openBinding(opener)
      return
    }
    setFocused(view)
    const panel = document.getElementById(id + '-' + view)
    panel?.focus({ preventScroll: true })
    if (window.innerWidth <= 920) panel?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  }

  function openPathway(opener: HTMLButtonElement) {
    pathwayOpener.current = opener
    setPathway(true)
  }

  function closePathway() {
    setPathway(false)
    requestAnimationFrame(() => {
      pathwayOpener.current?.focus({ preventScroll: true })
      pathwayOpener.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      pathwayOpener.current = null
    })
  }

  function seek(moment: number, view: AnatomyView) {
    setPosition(Math.min(moment, end))
    setPlaying(false)
    setFocused(view)
  }

  function nextMoment() {
    if (settled) {
      setPosition(0)
      return
    }
    const aura = episode.baseline.find(sample => sample.auraFront >= 0.34 && isAuraActive(sample))?.time
    const moments = [aura ?? episode.firstPeak + 1, episode.firstPeak + 4, episode.firstPeak + episode.factors.gap + 2,
      episode.lastRelease + 5, effectTime ?? end, end]
    moments.sort((a, b) => a - b)
    setPosition(moments.find(moment => moment > time + 0.1 && moment <= end) ?? end)
  }

  const load = Math.round(episode.triggerInput * 100)
  const playbackLabel = running ? 'Playing' : settled && !repeat ? 'Finished' : reduced ? 'Still frame' : 'Paused'
  const phaseMessage = settled
    ? shouldRepeat && running ? 'Next run starts automatically.' : reduced && shouldRepeat ? 'Use Next moment to return to the start.' : 'Play to see another episode.'
    : reduced && !playing ? 'Use Next moment or Play.' : betweenPulses ? 'The nerve quiets before the next pulse.' : statusText[modeledPhase]
  const pinTreatment = pinned && (findTreatment(pinned.episode.treatment)?.name ?? 'No treatment')

  return (
    <section className="mw-lab" aria-label="Live migraine lab" ref={root}>
      <div hidden={Boolean(pathway)}>
      <div className="mw-toolbar">
        <div className="mw-actions">
          {overview && <>
            <button type="button" className="button secondary" onClick={togglePlayback}><Icon name={playing ? 'pause' : 'play'} /> {playing ? 'Pause' : 'Play'}</button>
            {reduced && <button type="button" className="button secondary" disabled={playing || (settled && !repeat)} onClick={nextMoment}><Icon name="arrow" /> Next moment</button>}
            <button type="button" className="button secondary mw-pin" onClick={pinRun}>
              <Icon name="pin" /> {pinned ? 'Replace pin' : 'Pin this run'}
            </button>
            <label className="check-field mw-repeat"><input type="checkbox" checked={repeat} onChange={event => setRepeat(event.currentTarget.checked)} /> Repeat</label>
          </>}
          <button type="button" className="button secondary" onClick={reset}><Icon name="reset" /> Reset</button>
          <button type="button" className="button secondary mw-pathway" onClick={event => openPathway(event.currentTarget)}>
            <Icon name="head" /> Pathway
          </button>
          <button type="button" className="button secondary mw-explore" aria-controls={exploreId} onClick={onExplore}><Icon name="crosshair" /> Explore</button>
        </div>
      </div>
      <div className="mw-instrument" ref={instrument}>
        <div className="mw-overview" hidden={!overview}>
          <div className="mw-status" data-phase={phase}>
            <div role="status"><strong>{phase}</strong><span>{phaseMessage}</span></div>
            <span className="mw-clock" data-playing={running}><i aria-hidden="true" />{playbackLabel}<span aria-hidden="true"> · {time.toFixed(1)} / {end.toFixed(1)}</span></span>
          </div>
          <div className="mw-stage" data-phase={phase} data-time={time.toFixed(2)} data-zooming={Boolean(zoom)} style={zoom}>
            <HeadCutaway id={id} sample={current} nerve={untreated} focused={focused} inspect={inspect} bindingOpen={Boolean(binding)} />
            <MigraineViews id={id} current={{ sample: current, nerve: untreated, treatment, traces, canAttack }}
              pinned={pinnedFrame} untreated={untreated} auraEnabled={factors.aura} focused={focused}
              highlighted={highlighted} effectTime={effectTime} seek={seek} openBinding={openBinding} openPathway={openPathway} />
          </div>
          <div className="mw-comparison">
            <div className="mw-legend" aria-label="Chart key">
              <span><i /> Current run</span>
              {pinned && <span><i className="mw-pin-line" /> Pinned run</span>}
            </div>
            <div className="mw-pin-summary" role="status">
              {pinned ? <p>{pinTreatment} · Intensity {pinned.episode.factors.intensity} · Sensitivity {pinned.episode.factors.sensitivity} · Recovery {pinned.episode.factors.recoverySpeed}</p>
                : <p>Pin a run, then change a setting to compare.</p>}
            </div>
            {pinned && <button type="button" className="mw-clear-pin" onClick={() => setPinned(undefined)}>
              <Icon name="close" size={14} /> Clear pin
            </button>}
          </div>
        </div>
        <div id={id + '-binding'} hidden={!binding}>
          {binding && control && <ReceptorMicroscope id={id} style={binding} back={bindingBack} onBack={closeBinding}
            episode={episode} controlEpisode={bindingControl} sample={current} control={control}
            time={time} end={end} playing={running} pinned={Boolean(pinned)}
            treatedPin={Boolean(pinned && pinned.episode.treatment !== 'none')} exposure={exposure} canAttack={canAttack} canApplyNow={canApplyNow}
            onEffect={effectTime === undefined ? undefined : () => seek(effectTime, 'receptor')}
            onRecovery={bindingHandoff === undefined ? undefined : showRecovery}
            onWatch={watchBinding} onPlay={togglePlayback} onScrub={scrub}
            onPin={() => { pinUntreated(); setPlaying(false) }} />}
        </div>
        {showingRecovery && control && <HeadRecovery id={id + '-recovery'} back={recoveryBack} episode={episode}
          controlEpisode={bindingControl} sample={current} control={control} nerve={untreated}
          time={time} end={end} playing={running} onBack={() => setRecoveryStart(undefined)}
          onBinding={() => { setFollowBinding(undefined); setBinding({}) }} onPlay={togglePlayback} onScrub={scrub} />}
      </div>

      <fieldset className="mw-settings" id={id + '-settings'}>
        <legend>Controls</legend>
        <div className="mw-sliders">
          {sliders.map(({ key, label, hint }) => (
            <div className="factor mw-factor" key={key}>
              <div className="factor-label">
                <label htmlFor={id + '-' + key}>{label}</label>
                <div>{pinned && pinned.episode.factors[key] !== factors[key] && <span className="mw-pin-control">Pin {pinned.episode.factors[key]}</span>}
                  <output htmlFor={id + '-' + key}>{factors[key]}</output></div>
              </div>
              <input id={id + '-' + key} type="range" min={0} max={100} step={1} value={factors[key]}
                aria-describedby={id + '-' + key + '-hint'} onChange={event => {
                  const value = event.currentTarget.valueAsNumber
                  setFactors((current: Factors) => ({ ...current, [key]: value }))
                  markAdjustment(key)
                }} />
              <p id={id + '-' + key + '-hint'} className="mw-slider-hint">{hint}</p>
            </div>
          ))}
          <div className="mw-control-row">
            <fieldset className="ml-choices">
              <legend>Treatment</legend>
              {treatmentChoices.map(([value, label]) => <label key={value}>
                <input type="radio" name={id + '-treatment'} checked={treatment === value}
                  onChange={() => changeTreatment(value)} /> {label}
              </label>)}
            </fieldset>
            <label className="check-field">
              <input type="checkbox" checked={factors.aura} onChange={event => {
                const value = event.currentTarget.checked
                setFactors(current => ({ ...current, aura: value }))
                markAdjustment('aura')
              }} />
              Visual aura
            </label>
          </div>
        </div>
      </fieldset>

      <div className="mw-readout">
        <div className="mw-load">
          <span>Trigger load <strong>{load}</strong> / threshold {factors.threshold}</span>
          <meter min={0} max={100} value={load} aria-label="Trigger load in model units" />
        </div>
        {intervention && <a href={intervention.sources[0].url} target="_blank" rel="noreferrer">Treatment source <Icon name="external" size={12} /></a>}
      </div>
      <details className="mw-evidence">
        <summary>About the model</summary>
        <p>The cutaway places schematic nerve, vessel and cortex overlays on an illustration. The six views and both runs use the same clock. Nerve strength is a relative score derived from messenger release and local concentration. Recovery time counts from the last modeled nerve pulse until head pain stays at or below 2.5 out of 100. The clock and scores use model units.</p>
        <p>When a run is pinned, every panel still shows the current episode. The dashed traces, vessel outline, receptor comparison, and symptom tick marks show the pinned episode at the same moment.</p>
        <p><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC31895/" target="_blank" rel="noreferrer">Visual cortex study</a> <a href="https://pubmed.ncbi.nlm.nih.gov/21416486/" target="_blank" rel="noreferrer">Vascular imaging study</a></p>
      </details>
      </div>
      {pathway && <MigrainePathway options={options} root={pathwayBack} onBack={closePathway} />}
    </section>
  )
}
