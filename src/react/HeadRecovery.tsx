import { useMemo, type ReactNode, type RefObject } from 'react'
import { STEP, findTreatment, type EpisodeComparison, type Sample } from '../core/index.js'
import type { PainPathwayFrame } from '../core/pathway.js'
import { BindingSources, SignalReadout, bindingProgress, bindingStatus } from './BindingDetails.js'
import { CgrpBindingScene } from './CgrpBindingScene.js'
import { HeadCutaway } from './HeadCutaway.js'
import { Icon } from './icon.js'
import { RecoveryPathway, brainstemQuietAt, pathwaySignalAt, recoveryViewBox, type PathwayTimes } from './PathwayHeadMap.js'
import { CgrpTraces, ComparisonClock, ComparisonTrace, MilestoneTimeline, RunLegend, RunPlayback, type ComparisonLane } from './RunComparison.js'
import { HEAD_PAIN_SETTLED, painSettledAt, sampleBetween, treatmentTargetTime } from './workbench-episode.js'

type RunKind = 'untreated' | 'pinned' | 'current'
const runLabels = { untreated: 'Untreated', pinned: 'Pinned', current: 'Treated' } as const

export type PinnedTreatment = {
  treatment: EpisodeComparison['treatment']
  exposure: number
  samples: readonly Sample[]
  frames: readonly PainPathwayFrame[]
  engagement: number
}

type RecoveryRun = {
  kind: RunKind
  title: string
  readoutLabel?: string
  note: string
  sample: Sample
  nerve: Sample
  frames?: readonly PainPathwayFrame[]
  settles?: number
  binding?: Pick<PinnedTreatment, 'treatment' | 'exposure' | 'engagement'>
}

type RecoveryPathwayRuns = { times: PathwayTimes; untreated: readonly PainPathwayFrame[]; treated: readonly PainPathwayFrame[] }

function bindingMilestone(treatment: EpisodeComparison['treatment'], exposure: number, engagement: number, end: number) {
  const time = Math.ceil(treatmentTargetTime(exposure, engagement) / STEP) * STEP
  if (time > end) return undefined
  const label = treatment === 'sumatriptan' ? 'Sumatriptan binds serotonin receptor' :
    treatment === 'galcanezumab' ? 'Galcanezumab reaches CGRP target' : 'Ubrogepant reaches binding pocket'
  return { time, label }
}

function timelineLane(run: RecoveryRun['kind'], label: string, frames: readonly PainPathwayFrame[], times: PathwayTimes,
  settles: number | undefined, target: { time: number; label: string } | undefined, end: number): ComparisonLane {
  const quiet = brainstemQuietAt(frames, times, end)
  const milestones: ComparisonLane['milestones'][number][] = []
  if (target) milestones.push({ kind: 'target', ...target })
  if (quiet !== undefined && quiet === settles) {
    milestones.push({ kind: 'relay-and-pain', label: 'Brainstem quiet and pain settles', time: quiet })
  } else {
    if (quiet !== undefined) milestones.push({ kind: 'relay', label: 'Brainstem quiet', time: quiet })
    if (settles !== undefined && settles <= end) milestones.push({ kind: 'pain', label: 'Pain settles', time: settles })
  }
  return { run, label, milestones }
}

const nerveReadouts = [
  { key: 'incoming', label: 'Nerve input', short: 'Nerve input' },
  { key: 'relay', label: 'Brainstem output', short: 'Brainstem' },
  { key: 'thalamus', label: 'Thalamus response', short: 'Thalamus' },
] as const

function RecoveryHead({ id, run, time, times, showBinding, canEngage }: {
  id: string
  run: RecoveryRun
  time: number
  times?: PathwayTimes
  showBinding: boolean
  canEngage: boolean
}) {
  const { kind, title, note, sample, nerve, frames, binding, readoutLabel = runLabels[kind] } = run
  const pain = Math.round(sample.headache * 100)
  const progress = binding ? bindingProgress(sample, time, binding.exposure, binding.engagement) : 0

  return <section className={'mw-rx-pane mw-recovery-run mw-rx-' + kind} data-run={kind}
    aria-labelledby={id + '-title'}>
    <header className="mw-rx-pane-head"><h3 id={id + '-title'}>{title}</h3><span>{note}</span></header>
    {showBinding && <div className="mw-run-binding" role="group" aria-label={title + ' binding site'}>
      <CgrpBindingScene id={id + '-binding'} sample={sample} treatment={binding?.treatment ?? 'none'} progress={progress} zoom={0} />
      <div className="mw-run-binding-state">
        {binding ? bindingStatus(binding.treatment, progress, canEngage) : 'CGRP receptor'}
      </div>
      <SignalReadout sample={sample} label={readoutLabel} showRelease />
    </div>}
    <div className="mw-recovery-portrait" data-pathway={Boolean(frames && times)}>
      <HeadCutaway id={id} sample={sample} nerve={nerve} projection={frames && times ? {
        viewBox: recoveryViewBox,
        label: title + ' head cutaway with nerve pulses from the meninges through the brainstem to the thalamus.',
        overlay: <RecoveryPathway time={time} times={times} frames={frames} />,
      } : undefined} />
    </div>
    {frames && <dl className="mw-recovery-signals" aria-label={readoutLabel + ' modeled signals out of 100'}>
      {nerveReadouts.map(({ key, label, short }) => {
        const value = Math.round(pathwaySignalAt(frames, time, key) * 100)
        const measure = readoutLabel + ' ' + label.toLowerCase()
        return <div key={key}>
          <dt>{showBinding ? short : label}</dt>
          <dd><output aria-live="off" aria-label={measure}>{value}</output></dd>
          <meter min={0} max={100} value={value} aria-label={measure + ' level'} />
        </div>
      })}
    </dl>}
    <div className="mw-recovery-reading">
      <div>
        <span>Head pain</span>
        <div><output aria-live="off" aria-label={readoutLabel + ' head pain'}>{pain}</output><small> / 100</small></div>
      </div>
      <meter min={0} max={100} value={pain} aria-label={title + ' head pain level'} />
    </div>
  </section>
}

export function HeadRecovery({ id, back, episode, controlEpisode = episode, sample, control, nerve, pathway, time, end, playing,
  exposure, treatmentControls, pinnedTreatment, sameTime = false, onReplayTreatment, onBack, onBinding, onPlay, onStep, onScrub }: {
  id: string
  back?: RefObject<HTMLButtonElement | null>
  episode: EpisodeComparison
  controlEpisode?: EpisodeComparison
  sample: Sample
  control: Sample
  nerve: Sample
  pathway?: RecoveryPathwayRuns
  time: number
  end: number
  playing: boolean
  exposure?: number
  treatmentControls?: ReactNode
  pinnedTreatment?: PinnedTreatment
  sameTime?: boolean
  onReplayTreatment?: () => void
  onBack?: () => void
  onBinding: () => void
  onPlay?: () => void
  onStep?: () => void
  onScrub: (time: number) => void
}) {
  const name = findTreatment(episode.treatment)?.name ?? 'Treated'
  const pinnedName = pinnedTreatment && (findTreatment(pinnedTreatment.treatment)?.name ?? 'Treated')
  const pinnedTitle = sameTime ? pinnedName ?? 'Sumatriptan' : 'Pinned treatment'
  const currentTitle = sameTime || !pinnedTreatment ? name : 'Current treatment'
  const difference = Math.round(control.headache * 100) - Math.round(sample.headache * 100)
  const amount = Math.abs(difference)
  const treatedSettles = useMemo(() => painSettledAt(episode.treated, episode.lastRelease), [episode.treated, episode.lastRelease])
  const untreatedSettles = useMemo(() => painSettledAt(controlEpisode.baseline, controlEpisode.lastRelease),
    [controlEpisode.baseline, controlEpisode.lastRelease])
  const pinnedSettles = useMemo(() => pinnedTreatment && painSettledAt(pinnedTreatment.samples, episode.lastRelease),
    [pinnedTreatment, episode.lastRelease])
  const canEngage = episode.treatment !== 'none' && episode.factors.strength > 0 && episode.triggerInput * 100 > episode.factors.threshold
  const lanes = useMemo(() => {
    if (!pathway || exposure === undefined) return
    const result = [timelineLane('untreated', 'Untreated', pathway.untreated, pathway.times, untreatedSettles, undefined, end)]
    if (pinnedTreatment) {
      const target = canEngage ? bindingMilestone(pinnedTreatment.treatment, pinnedTreatment.exposure, pinnedTreatment.engagement, end) : undefined
      result.push(timelineLane('pinned', pinnedTitle, pinnedTreatment.frames, pathway.times, pinnedSettles, target, end))
    }
    result.push(timelineLane('current', currentTitle, pathway.treated, pathway.times, treatedSettles,
      canEngage ? bindingMilestone(episode.treatment, exposure, episode.factors.engagement, end) : undefined, end))
    return result
  }, [pathway, exposure, episode.treatment, episode.factors.engagement, pinnedTreatment, canEngage,
    untreatedSettles, pinnedSettles, treatedSettles, end, pinnedTitle, currentTitle])
  const pinnedSample = pinnedTreatment && sampleBetween(pinnedTreatment.samples, time)
  const bothSettled = time >= Math.max(episode.lastRelease, controlEpisode.lastRelease) &&
    sample.headache <= HEAD_PAIN_SETTLED && control.headache <= HEAD_PAIN_SETTLED
  const relayQuiet = pathway && pathwaySignalAt(pathway.treated, time, 'relay') < .005 &&
    pathwaySignalAt(pathway.untreated, time, 'relay') >= .025
  const beforeTreatment = exposure !== undefined && time < exposure
  const status = sameTime ? 'The nerve releases CGRP, shown in gold. Brighter pulses show a stronger nerve signal.' :
    pinnedTreatment ? 'Brighter pulses carry stronger signals.' :
    beforeTreatment ? 'Both runs match here. Treatment starts at model time ' + exposure + '.' :
    bothSettled ? 'Head pain has settled in both runs.' :
    relayQuiet ? 'The treated brainstem relay has quieted. The untreated relay is still active.' :
    pathway ? 'Brighter pulses carry a stronger modeled signal. Readings are out of 100.' :
    'The glow at her temple follows the modeled pain in each run.'
  const runs: RecoveryRun[] = [{
    kind: 'untreated',
    title: 'Untreated',
    note: pathway ? 'Same attack' : controlEpisode !== episode && controlEpisode.treatment !== 'none' ? 'From pinned run' : 'Pinned run',
    sample: control,
    nerve: control,
    frames: pathway?.untreated,
    settles: untreatedSettles,
  }]
  if (pinnedTreatment && pinnedSample) runs.push({
    kind: 'pinned',
    title: pinnedTitle,
    readoutLabel: sameTime ? pinnedTitle : undefined,
    note: sameTime ? 'Triptan · reduces CGRP release' : pinnedName + ' at ' + pinnedTreatment.exposure,
    sample: pinnedSample,
    nerve: pinnedSample,
    frames: pinnedTreatment.frames,
    settles: pinnedSettles,
    binding: sameTime ? pinnedTreatment : undefined,
  })
  runs.push({
    kind: 'current',
    title: currentTitle,
    readoutLabel: sameTime ? currentTitle : undefined,
    note: sameTime ? 'Gepant · blocks the CGRP receptor' : pinnedTreatment ? name + ' at ' + exposure : 'Treated run',
    sample,
    nerve,
    frames: pathway?.treated,
    settles: treatedSettles,
    binding: sameTime && exposure !== undefined ? { treatment: episode.treatment, exposure, engagement: episode.factors.engagement } : undefined,
  })
  const settling = treatmentControls && <dl className="mw-recovery-settling">
    <div>
      <dt>Pain settles at</dt>
      <dd>Model time · stays at or below 2.5 / 100</dd>
    </div>
    {runs.map(run => <div key={run.kind} data-run={run.kind}>
      <dt>{pinnedTreatment ? run.title : runLabels[run.kind]}</dt>
      <dd><output aria-label={(run.readoutLabel ?? runLabels[run.kind]) + ' settling time'} aria-live="off">{run.settles ?? 'Past the end'}</output></dd>
    </div>)}
  </dl>

  const clock = { time, end, playing, onScrub }

  return <section className="mw-rx-workspace mw-recovery" aria-labelledby={id + '-title'} data-time={time.toFixed(2)} data-binding-visible={sameTime}
    onKeyDown={event => {
      if (event.key === 'Escape' && onBack) {
        event.preventDefault()
        onBack()
      }
    }}>
    <header className="mw-rx-header">
      <div className="mw-rx-title">
        {onBack && <button type="button" className="mw-rx-back" ref={back} onClick={onBack}><Icon name="arrow" size={15} /> Back to overview</button>}
        <h2 id={id + '-title'} tabIndex={sameTime ? -1 : undefined}>{sameTime ? 'Treatment comparison' : 'Head pain after treatment'}</h2>
        <p>{status}</p>
      </div>
      <div className="mw-rx-header-actions">
        {onReplayTreatment && <button type="button" className="mw-rx-action" onClick={onReplayTreatment}>
          <Icon name="reset" size={15} /> {pinnedTreatment ? 'Replay comparison' : 'Replay from treatment'}
        </button>}
        <button type="button" className="mw-rx-scale" onClick={onBinding}>
          {sameTime ? 'Explore treatment timing' : <><Icon name="zoom" size={15} /> Binding view</>}
        </button>
      </div>
    </header>

    {!sameTime && treatmentControls}
    <div className="mw-recovery-controls">
      {lanes && <ComparisonClock label={sameTime ? 'Treatment comparison' : 'Head pain'} {...clock} onPlay={onPlay}
        onStep={onStep} milestones={sameTime ? undefined : lanes} />}
      {sameTime && treatmentControls}
    </div>
    <div className="mw-rx-panes mw-recovery-panes" data-runs={runs.length}>
      {runs.map(run => <RecoveryHead key={run.kind} id={id + '-' + run.kind} run={run} time={time} times={pathway?.times}
        showBinding={sameTime} canEngage={canEngage} />)}
    </div>
    {sameTime && lanes && <MilestoneTimeline lanes={lanes} {...clock} />}

    <div className="mw-rx-chart mw-recovery-chart">
      <div className="mw-rx-chart-heading">
        <h3>Head pain over time</h3>
        {!pinnedTreatment && <span>{difference === 0 ? 'Same pain level now' : amount + (amount === 1 ? ' point ' : ' points ') +
          (difference > 0 ? 'less' : 'more') + ' pain in the treated run'}</span>}
      </div>
      <ComparisonTrace measure="headache" untreated={controlEpisode.baseline} current={episode.treated}
        time={time} end={end} exposure={exposure} pinned={pinnedTreatment}
        seriesNames={sameTime ? { pinned: pinnedTitle, current: currentTitle } : undefined} />
      {sameTime && pinnedTreatment && exposure !== undefined && <CgrpTraces untreated={controlEpisode.baseline}
        current={episode.treated} triptan={pinnedTreatment} exposure={exposure} time={time} end={end} />}
      {!lanes && <RunPlayback label="Head pain" time={time} end={end} playing={playing} onPlay={onPlay} onScrub={onScrub} />}
      <div className="mw-rx-foot">
        <RunLegend extra={pinnedTreatment ? sameTime ? pinnedTitle : 'Pinned' : undefined}
          current={sameTime ? currentTitle : pinnedTreatment ? 'Current' : 'Treated'}
          showTreatmentTime={exposure !== undefined && exposure < end} multiple={Boolean(pinnedTreatment) && !sameTime} />
        <span>Model time</span>
      </div>
      {settling}
    </div>
    {sameTime && <BindingSources treatments={['sumatriptan', 'ubrogepant']} />}
  </section>
}
