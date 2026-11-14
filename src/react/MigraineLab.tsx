import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ANATOMY_EVIDENCE, compareEpisode, createFactors, DURATION, episodeCsv, episodePhase, FACTOR_GROUPS, FACTORS, findTreatment,
  isAuraActive, randomTrigger, sampleAt, TREATMENTS, treatmentStart, TRIGGER_EVIDENCE,
  STEP, TRIGGER_INTENSITY, TRIGGERS, visualAuraAt,
  type BodyModel, type FactorDefinition, type Factors, type HeadRegion, type Intervention, type NumericFactor, type Pathway,
  type Sample, type Scale, type Source, type TriggerId,
} from '../core/index.js'
import { Icon } from './icon.js'
import { MigrainePathway } from './MigrainePathway.js'
import { MigraineWorkbench } from './MigraineWorkbench.js'
import { Readouts } from './Readouts.js'
import { Viewport } from './Viewport.js'

export interface MigraineLabProps {
  initialMode?: 'pathway' | 'walkthrough' | 'explore'
  initialBody?: BodyModel
  initialTrigger?: TriggerId
  initialTreatment?: Intervention
  initialFactors?: Partial<Factors>
  initialScale?: Scale
  initialHeadRegion?: HeadRegion
  initialPathway?: Pathway
  /** Model time units per second of playback. */
  playbackRate?: number
  className?: string
}

const treatmentGroups = ['Acute treatment', 'Preventive treatment', 'Investigational', 'Past trial'] as const
const statusLabel: Record<(typeof treatmentGroups)[number], string> = {
  'Acute treatment': 'U.S. approved · acute',
  'Preventive treatment': 'U.S. approved · prevention',
  Investigational: 'Investigational',
  'Past trial': 'Past trial · no benefit over placebo',
}

function factor(key: NumericFactor) {
  return FACTORS.find(item => item.key === key)!
}

function viewMessage(sample: Sample, region: HeadRegion, scale: Scale, phase: ReturnType<typeof episodePhase>, pathway: Pathway) {
  if (phase === 'Below threshold') return 'Raise trigger intensity to cross the threshold.'
  if (scale === 'head' && region === 'cortex') return isAuraActive(sample) ? 'A wave is moving across the visual cortex.' : 'The visual cortex is quiet.'
  if (scale === 'head') return sample.freeCgrp + sample.freePacap > 0.04 ? 'Watch the signal travel from the lining of the skull toward the ganglion.' : 'Follow the three sensory branches from the ganglion.'
  if (scale === 'cells') {
    const free = pathway === 'cgrp' ? sample.freeCgrp : sample.freePacap
    return free > 0.025 ? 'Watch the messengers cross the gap and bind.' : 'The gap is quiet. Pick a trigger to see messenger release.'
  }
  if (scale === 'receptor') return 'Rotate to see where the peptide binds above the membrane.'
  if (phase === 'Ready') return 'Symptoms will appear here during an episode.'
  if (phase === 'Trigger') return 'The trigger has crossed the attack threshold.'
  if (phase === 'Settled') return 'The modeled symptoms have settled.'
  return 'The markers show where modeled symptoms are felt.'
}

function Factor({ definition, value, change, compact = false }: {
  definition: FactorDefinition
  value: number
  change: (value: number) => void
  compact?: boolean
}) {
  const id = useId()
  const { key, label, description, min, max, unit } = definition
  return <div className="factor">
    <div className="factor-label"><label htmlFor={id}>{label}</label><output htmlFor={id}>{value}</output></div>
    <input type="range" id={id} data-factor={key} min={min} max={max} step={1} value={value}
      aria-valuetext={value + ' ' + unit} aria-describedby={compact ? undefined : id + '-help'}
      onChange={event => change(event.currentTarget.valueAsNumber)} />
    {!compact && <p className="field-note" id={id + '-help'}>{description}</p>}
  </div>
}

function Sources({ sources }: { sources: readonly Source[] }) {
  return <div className="source-links">{sources.map(source => (
    <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} <Icon name="external" size={12} /></a>
  ))}</div>
}

export function MigraineLab(props: MigraineLabProps = {}) {
  const mode = props.initialMode ?? 'pathway'
  return <div className={['ml-lab', props.className].filter(Boolean).join(' ')}>
    {mode === 'pathway' ? <MigrainePathway options={props} /> : <Overview {...props} />}
  </div>
}

function Overview(props: MigraineLabProps) {
  const id = useId()
  const live = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLButtonElement>(null)
  const [exploring, setExploring] = useState(props.initialMode === 'explore')
  const [openedExplore, setOpenedExplore] = useState(exploring)

  return (
    <>
      <div id={id + '-lab'} ref={live} hidden={exploring}>
        <MigraineWorkbench options={props} active={!exploring} exploreId={id + '-explore'} onExplore={() => {
          setOpenedExplore(true)
          setExploring(true)
          requestAnimationFrame(() => back.current?.focus())
        }} />
      </div>
      <div id={id + '-explore'} hidden={!exploring}>
        <button type="button" className="button secondary mw-back" aria-controls={id + '-lab'} ref={back} onClick={() => {
          setExploring(false)
          requestAnimationFrame(() => live.current?.querySelector<HTMLButtonElement>('.mw-explore')?.focus())
        }}>
          Back to live lab
        </button>
        {openedExplore && <ExploreLab {...props} active={exploring} />}
      </div>
    </>
  )
}

function ExploreLab({
  initialBody = 'female',
  initialTrigger = 'weather',
  initialTreatment = 'none',
  initialFactors,
  initialScale = 'body',
  initialHeadRegion = 'nerve',
  initialPathway,
  playbackRate = 5,
  active,
}: MigraineLabProps & { active: boolean }) {
  const id = useId()
  const stage = useRef<HTMLDivElement>(null)
  const treatmentPicker = useRef<HTMLFieldSetElement>(null)
  const clock = useRef(0)
  const customStart = useRef(initialFactors?.start !== undefined)
  const [motionAllowed, setMotionAllowed] = useState(true)
  const initialSignal = initialPathway ?? findTreatment(initialTreatment)?.pathway ?? 'cgrp'
  const [body, setBody] = useState(initialBody)
  const [trigger, setTrigger] = useState(initialTrigger)
  const [treatment, setTreatment] = useState(initialTreatment)
  const [factors, setFactors] = useState(() => createFactors(initialFactors, initialTreatment))
  const [scale, setScale] = useState(initialScale)
  const [region, setRegion] = useState(initialHeadRegion)
  const [pathway, setPathway] = useState<Pathway>(initialSignal)
  const [time, setTime] = useState(0)
  const [triggered, setTriggered] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [treatmentAppliedAt, setTreatmentAppliedAt] = useState<number>()
  const [auraTime, setAuraTime] = useState<number>()
  const auraPreview = auraTime !== undefined
  const [auraPaused, setAuraPaused] = useState(false)
  const [reading, setReading] = useState<'baseline' | 'treated'>('treated')
  const selected = findTreatment(treatment)
  const event = TRIGGERS.find(item => item.id === trigger) ?? TRIGGERS[0]
  const episode = useMemo(() => compareEpisode({ trigger, factors, treatment, triggered, treatmentAppliedAt }),
    [trigger, factors, treatment, triggered, treatmentAppliedAt])
  const untreatedSample = sampleAt(episode.baseline, time)
  const treatedSample = sampleAt(episode.treated, time)
  const sample = reading === 'baseline' ? untreatedSample : treatedSample
  const sceneSample = auraTime === undefined ? sample : { ...sample, ...visualAuraAt(auraTime, factors) }
  const auraSpeed = visualAuraAt(1, factors).auraFront
  const previewLimit = factors.auraRecovery + 1 / auraSpeed
  const previewRunning = auraTime !== undefined && auraTime < previewLimit && !auraPaused
  const targetSignal = selected?.pathway === 'pacap' ? 'pacapSignal' : 'cgrpSignal'
  const phase = episodePhase(episode, sample)
  const thresholdCrossed = episode.triggerInput * 100 > factors.threshold
  const input = triggered && thresholdCrossed
    ? episode.triggerInput * Math.max(0, 1 - time / (episode.firstPeak * 1.3)) : 0
  const rate = Number.isFinite(playbackRate) ? Math.max(0.5, Math.min(24, playbackRate)) : 5

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    function sync() { setMotionAllowed(!query.matches) }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!active || (!playing && !previewRunning)) return
    let frame = 0
    let previous: number | undefined
    function tick(now: number) {
      const delta = previous === undefined ? 0 : Math.min(100, now - previous) / 1000
      previous = now
      if (!document.hidden) {
        if (playing) {
          clock.current = Math.min(DURATION, clock.current + rate * delta)
          setTime(Math.floor(clock.current / STEP) * STEP)
        }
        if (previewRunning) setAuraTime(current => current === undefined ? current : Math.min(previewLimit, current + rate * delta))
      }
      if (playing && clock.current >= DURATION) setPlaying(false)
      if (previewRunning || clock.current < DURATION) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, playing, rate, previewRunning, previewLimit])

  function seek(value: number) {
    clock.current = value
    setTime(value)
  }

  function start(next: TriggerId) {
    setTrigger(next)
    setTriggered(true)
    setAuraTime(undefined)
    setTreatmentAppliedAt(undefined)
    setReading('treated')
    const snapshot = motionAllowed ? 0 : compareEpisode({ trigger: next, factors, treatment }).firstPeak + 1.5
    seek(snapshot)
    setPlaying(motionAllowed)
    moveToView()
  }

  function changeFactor(key: NumericFactor, value: number) {
    if (key === 'start') customStart.current = true
    setFactors(current => ({ ...current, [key]: value }))
  }

  function moveToView() {
    const element = stage.current
    if (!element) return
    const bounds = element.getBoundingClientRect()
    if (bounds.top < 0 || bounds.top > window.innerHeight * 0.45) element.scrollIntoView({ block: 'start' })
  }

  function previewAura() {
    setScale('head')
    setRegion('cortex')
    setAuraPaused(!motionAllowed)
    setAuraTime(isAuraActive(sample) ? undefined : motionAllowed ? 0 : Math.min(previewLimit, 0.46 / auraSpeed))
    moveToView()
  }

  function chooseScale(next: Scale) {
    setScale(next)
    if (next !== 'head') setAuraTime(undefined)
  }

  function chooseRegion(next: HeadRegion) {
    setRegion(next)
    if (next === 'nerve') setAuraTime(undefined)
  }

  function compare(next: Intervention) {
    const applying = triggered && clock.current < episode.lastRelease
    setTreatment(next)
    setReading('treated')
    setTreatmentAppliedAt(applying ? clock.current : undefined)
    if (!customStart.current) setFactors(current => ({ ...current, start: applying ? Math.floor(clock.current) : treatmentStart(next) }))
    const intervention = findTreatment(next)
    if (!intervention) {
      setTreatmentAppliedAt(undefined)
      return
    }
    setPathway(intervention.pathway)
    setAuraTime(undefined)
    setScale('cells')
    if (applying && motionAllowed) setPlaying(true)
    moveToView()
  }

  function reset() {
    setBody(initialBody)
    setTrigger(initialTrigger)
    setTreatment(initialTreatment)
    setFactors(createFactors(initialFactors, initialTreatment))
    setScale(initialScale)
    setRegion(initialHeadRegion)
    setPathway(initialSignal)
    setTriggered(false)
    setPlaying(false)
    setReading('treated')
    setAuraTime(undefined)
    setTreatmentAppliedAt(undefined)
    customStart.current = initialFactors?.start !== undefined
    seek(0)
  }

  function exportRun() {
    const url = URL.createObjectURL(new Blob([episodeCsv(episode)], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'migraine-lab-' + trigger + '.csv'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const canPause = (triggered && time < DURATION) || (auraTime !== undefined && auraTime < previewLimit)
  const running = playing || previewRunning
  function toggleLive() {
    if (triggered && time < DURATION) setPlaying(!running)
    if (auraTime !== undefined) setAuraPaused(running)
  }

  return (
    <div>
      <div className="lab-grid">
        <section className="trigger-panel" aria-labelledby={id + '-trigger'}>
          <h2 id={id + '-trigger'}>Trigger a migraine</h2>
          <p className="panel-hint">Pick an event to start.</p>
          <div className="trigger-options">
            {TRIGGERS.map(item => (
              <button className="trigger-option" type="button" key={item.id} title={item.event}
                aria-pressed={triggered && trigger === item.id} onClick={() => start(item.id)}>
                <Icon name={item.id} size={19} /><span>{item.name}</span>
              </button>
            ))}
            <button className="trigger-option random-event" type="button" onClick={() => start(randomTrigger(trigger))}><Icon name="random" size={19} /> Random event</button>
          </div>
          <Factor definition={TRIGGER_INTENSITY} value={factors.intensity} change={value => changeFactor('intensity', value)} compact />
          <div className="threshold-readout">
            <span>Trigger input <strong>{Math.round(episode.triggerInput * 100)}</strong></span>
            <span>Threshold <strong>{factors.threshold}</strong></span>
          </div>
        </section>

        <div className="workspace" ref={stage}>
          <Viewport body={body} scale={scale} region={region} pathway={pathway} sample={sceneSample} settings={factors} input={input}
            activeTreatment={selected?.name}
            setBody={setBody} setScale={chooseScale} setRegion={chooseRegion} setPathway={setPathway}
            effect={reading === 'treated' ? selected : undefined} onAura={previewAura} />
          <div className="run-status" data-phase={auraPreview ? 'Aura' : phase}>
            <div className="phase-message">
              <strong role="status">{auraPreview ? 'Aura preview' : phase === 'Trigger' ? 'Starting' : phase}</strong>
              {triggered && <span className="event-label">{event.name}</span>}
              <p>{auraTime !== undefined && auraTime >= previewLimit ? 'The visual field has cleared.' : viewMessage(sceneSample, region, scale, auraPreview ? 'Aura' : phase, pathway)}</p>
            </div>
            <div className="live-actions">
              {canPause && (
                <button className="icon-button" type="button" title={running ? 'Pause' : 'Resume'} aria-label={running ? 'Pause' : 'Resume'}
                  onClick={toggleLive}><Icon name={running ? 'pause' : 'play'} /></button>
              )}
              <button className="icon-button" type="button" title="Reset lab" aria-label="Reset lab" onClick={reset}><Icon name="reset" /></button>
            </div>
          </div>
          {triggered && <div className="live-meters">
            {([
              ['Head pain', sample.headache],
              ['Light sensitivity', sample.lightSensitivity],
              ['Nausea', sample.nausea],
            ] as const).map(([label, value]) => (
              <div className="live-meter" key={label}><span>{label}</span><strong>{Math.round(value * 100)}</strong>
                <meter min={0} max={100} value={Math.round(value * 100)} aria-label={label} /></div>
            ))}
          </div>}
          {selected && triggered && <div className="cell-comparison">
            <span>{selected.pathway === 'cgrp' ? 'CGRP' : 'PACAP'} response</span>
            <strong>{Math.round(untreatedSample[targetSignal] * 100)}</strong>
            <Icon name="arrow" size={13} />
            <strong>{Math.round(treatedSample[targetSignal] * 100)}</strong>
            <div className="subview" aria-label="Run displayed in 3D">
              <button type="button" aria-pressed={reading === 'baseline'} onClick={() => setReading('baseline')}>Untreated</button>
              <button type="button" aria-pressed={reading === 'treated'} onClick={() => setReading('treated')}>With treatment</button>
            </div>
          </div>}
          <div className="quick-actions" aria-label="Explore the episode">
            <button className="button secondary" type="button" onClick={previewAura}><Icon name="eye" /> Watch aura</button>
            <button className="button secondary" type="button"
              onClick={() => treatmentPicker.current?.querySelector<HTMLInputElement>('input:checked')?.focus()}>
              Choose treatment <Icon name="arrow" size={14} />
            </button>
          </div>
        </div>

        <div className="view-controls">
          {scale === 'body' && triggered && <Factor definition={factor('recoverySpeed')} value={factors.recoverySpeed} change={value => changeFactor('recoverySpeed', value)} compact />}
          {scale === 'head' && region === 'cortex' && <Factor definition={factor('auraSpeed')} value={factors.auraSpeed} change={value => changeFactor('auraSpeed', value)} compact />}
          {scale === 'cells' && <div className="cell-controls">
            <Factor definition={factor('distance')} value={factors.distance} change={value => changeFactor('distance', value)} compact />
            <Factor definition={factor('receptors')} value={factors.receptors} change={value => changeFactor('receptors', value)} compact />
          </div>}
        </div>

        <section className="aura-panel" aria-labelledby={id + '-aura'}>
          <h2 id={id + '-aura'}>Visual aura</h2>
          <label className="check-field"><input type="checkbox" checked={factors.aura} onChange={event => {
            setAuraTime(undefined)
            setFactors(current => ({ ...current, aura: event.target.checked }))
          }} /> Include in attacks</label>
          <button className="button secondary" type="button" onClick={previewAura}><Icon name="eye" /> Watch aura</button>
        </section>

        <section className="treatment-panel" aria-labelledby={id + '-treat'}>
          <h2 id={id + '-treat'}>Treatment</h2>
          <fieldset className="ml-choices" ref={treatmentPicker}>
            <legend className="sr-only">Treatment choice</legend>
            <label><input type="radio" name={id + '-intervention'} checked={treatment === 'none'}
              onChange={() => compare('none')} /> No treatment</label>
            {treatmentGroups.map(status => <div className="ml-choice-group" key={status}>
              <strong>{status}</strong>
              {TREATMENTS.filter(item => item.status === status).map(item => <label key={item.id}>
                <input type="radio" name={id + '-intervention'} checked={treatment === item.id}
                  onChange={() => compare(item.id)} /> {item.name}
              </label>)}
            </div>)}
          </fieldset>
          {selected ? (
            <div className="mechanism">
              <strong>{statusLabel[selected.status]}</strong>
              <p>{selected.mechanism}</p>
              {(!triggered || time >= episode.lastRelease) && <p className="field-note">Pick an event to run the comparison.</p>}
              {scale === 'cells' && <Factor definition={factor('strength')} value={factors.strength} change={value => changeFactor('strength', value)} compact />}
              <a href={'#' + id + '-evidence-' + selected.id}>Treatment evidence <Icon name="arrow" size={13} /></a>
            </div>
          ) : <p className="field-note treatment-prompt">Choose a treatment to see where it acts.</p>}
        </section>
      </div>

      <section className="section-band results" aria-labelledby={id + '-results'}>
        <details className="optional-section">
          <summary id={id + '-results'}>Compare signals and symptoms</summary>
          <Readouts episode={episode} sample={sample} pathway={pathway} setPathway={setPathway} />
        </details>
      </section>

      <section className="section-band controls" aria-labelledby={id + '-controls'}>
        <details className="optional-section">
          <summary id={id + '-controls'}>Advanced controls</summary>
          <div className="section-header">
            <p>Values use model units. Changes affect both runs.</p>
            <button className="button secondary" type="button" disabled={!triggered} onClick={exportRun}><Icon name="download" /> Export run</button>
          </div>
          <div className="factor-grid">
            {FACTOR_GROUPS.map(group => (
              <fieldset className="factor-group" key={group.label}>
                <legend>{group.label}</legend>
                {group.factors.map(definition => <Factor key={definition.key} definition={definition} value={factors[definition.key]}
                  change={value => changeFactor(definition.key, value)} />)}
              </fieldset>
            ))}
          </div>
        </details>
      </section>

      <section className="section-band" aria-labelledby={id + '-evidence'}>
        <div className="section-header"><div><h2 id={id + '-evidence'}>Treatments and evidence</h2><p>Approval status refers to the U.S. Each comparison isolates one target in the model.</p></div></div>
        <div className="treatment-list">
          {TREATMENTS.map(item => (
            <article className="treatment" key={item.id} id={id + '-evidence-' + item.id}>
              <div><h3>{item.name}</h3><p className="field-note">{item.className}</p></div>
              <div className="treatment-detail"><strong>{statusLabel[item.status]}</strong><p>{item.mechanism}</p><p>{item.evidence}</p><Sources sources={item.sources} /></div>
              <button className="button secondary" type="button" onClick={() => compare(item.id)}>Show target <Icon name="arrow" /></button>
            </article>
          ))}
        </div>
        <div className="model-evidence">
          <h3>Triggers and the model</h3>
          <p>Reported triggers vary by person. The lab gives each example a brief, sustained, or gradual exposure using the same signaling model. Intensity, background conditions and sensitivity determine whether the input crosses the threshold.</p>
          <Sources sources={TRIGGER_EVIDENCE} />
          <h3>Anatomy and visual aura</h3>
          <p>The Human Reference Atlas brain sits inside the teaching head. Nerve paths and the enlarged cell are schematic. The cortex shows one possible visual aura, and the receptor views trace measured structures.</p>
          <Sources sources={ANATOMY_EVIDENCE} />
        </div>
      </section>
    </div>
  )
}
