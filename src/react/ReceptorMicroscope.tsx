import { useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { findTreatment, type EpisodeComparison, type Sample } from '../core/index.js'
import { BindingSources, SignalReadout, bindingProgress, bindingStatus } from './BindingDetails.js'
import { CgrpBindingScene } from './CgrpBindingScene.js'
import { Icon } from './icon.js'
import { ComparisonClock, ComparisonTrace, RunLegend, RunPlayback } from './RunComparison.js'
import { sampleBetween, treatmentTargetTime } from './workbench-episode.js'

const points = (value: number) => Math.round(value * 100)
const unit = (value: number) => Math.max(0, Math.min(1, value))

type BindingRun = { samples: readonly Sample[]; exposure: number; treatment: EpisodeComparison['treatment']; engagement: number }

export function ReceptorMicroscope({ id, style, back, onBack, episode, controlEpisode, sample, control, time, end,
  playing, pinned, treatedPin, exposure, canAttack, canApplyNow, choices, pinnedTreatment, autoZoomStart,
  showTreatmentTime = episode.treatment === 'ubrogepant',
  onWatch, onPlay, onScrub, onPin, onEffect, onRecovery }: {
  id: string
  style?: CSSProperties
  back?: RefObject<HTMLButtonElement | null>
  onBack?: () => void
  episode: EpisodeComparison
  controlEpisode: EpisodeComparison
  sample: Sample
  control: Sample
  time: number
  end: number
  playing: boolean
  pinned: boolean
  treatedPin: boolean
  exposure: number
  canAttack: boolean
  canApplyNow: boolean
  choices?: ReactNode
  pinnedTreatment?: BindingRun
  autoZoomStart?: number
  showTreatmentTime?: boolean
  onWatch: () => void
  onPlay?: () => void
  onScrub: (time: number) => void
  onPin?: () => void
  onEffect?: () => void
  onRecovery?: () => void
}) {
  const [manualZoom, setManualZoom] = useState<boolean>()
  const treatment = episode.treatment
  const treatmentDetails = findTreatment(treatment)
  const delta = points(control.cgrpSignal) - points(sample.cgrpSignal)
  const treated = treatment !== 'none'
  const title = treatmentDetails?.name ?? 'Current run'
  const boundAt = treatmentTargetTime(exposure, episode.factors.engagement)
  const progress = bindingProgress(sample, time, exposure, episode.factors.engagement)
  const automaticZoom = autoZoomStart === undefined ? 0 :
    unit((time - autoZoomStart) / 1.4) * unit((Math.max(autoZoomStart + 3, boundAt + 2.6) - time) / 1.6)
  const zoom = manualZoom === undefined ? automaticZoom : Number(manualZoom)
  const magnified = zoom > .5
  const boundBeforeView = autoZoomStart !== undefined && boundAt <= autoZoomStart
  const canEngage = canAttack && episode.factors.strength > 0
  const bindingState = bindingStatus(treatment, progress, canEngage, boundBeforeView)
  const pinnedSample = pinnedTreatment && sampleBetween(pinnedTreatment.samples, time)
  const pinnedProgress = pinnedTreatment && pinnedSample
    ? bindingProgress(pinnedSample, time, pinnedTreatment.exposure, pinnedTreatment.engagement)
    : 0
  const pinnedName = pinnedTreatment && findTreatment(pinnedTreatment.treatment)?.name
  const watch = treated ? 'Replay binding' : canApplyNow ? 'Apply ubrogepant' : 'Play with ubrogepant'
  const hasTriptan = treatment === 'sumatriptan' || pinnedTreatment?.treatment === 'sumatriptan'
  const titleId = id + '-binding-title'
  const mechanism = treatment === 'sumatriptan' ? 'Sumatriptan is a triptan. It activates serotonin receptors on the nerve ending. In the model this reduces how much CGRP the nerve releases.' :
    treatment === 'galcanezumab' ? 'Galcanezumab is a preventive antibody that binds free CGRP before it can reach the receptor.' :
    'Ubrogepant (Ubrelvy) is a gepant. It blocks the receptor for CGRP, a chemical messenger in migraine pain signaling.'
  return <section className="mw-rx-workspace" aria-labelledby={titleId} data-time={time.toFixed(2)}
    data-from-head={autoZoomStart !== undefined}
    style={style} onKeyDown={event => {
      if (event.key === 'Escape' && onBack) {
        event.preventDefault()
        onBack()
      }
    }}>
    <header className="mw-rx-header">
      <div className="mw-rx-title">
        {onBack && <button type="button" className="mw-rx-back" ref={back} onClick={onBack}>
          <Icon name="arrow" size={15} /> Back to head
        </button>}
        <h2 id={titleId}>{hasTriptan ? 'Where treatment acts' : 'CGRP binding site'}</h2>
        <p>{mechanism}</p>
      </div>
      <div className="mw-rx-header-actions">
        {onRecovery && (progress > 0 || !onBack) &&
          <button type="button" className="mw-rx-next" onClick={onRecovery}>See head pain <Icon name="arrow" size={15} /></button>}
        {onEffect && <button type="button" className="mw-rx-back" onClick={onEffect}>Peak effect</button>}
        <button type="button" className="mw-rx-action" onClick={() => { setManualZoom(undefined); onWatch() }}>
          <Icon name={treated ? 'reset' : 'play'} /> {watch}
        </button>
      </div>
    </header>
    {choices}
    {pinnedTreatment && <ComparisonClock label="Binding" time={time} end={end} playing={playing} onPlay={onPlay} onScrub={onScrub} />}

    <div className="mw-rx-panes" data-runs={pinnedTreatment ? 3 : 2}>
      <section className="mw-rx-pane mw-rx-untreated" aria-label="Untreated binding site">
        <div className="mw-rx-pane-head"><h3>Untreated</h3>{pinned
          ? <span>{treatedPin ? 'From pinned run' : onPin ? 'Pinned run' : 'Same attack'}</span>
          : <button className="mw-rx-pin" type="button" onClick={onPin}><Icon name="pin" size={13} /> Pin untreated</button>}</div>
        <CgrpBindingScene id={id + '-rx-untreated'} sample={control} treatment="none" progress={0} zoom={zoom} />
        <SignalReadout sample={control} label="Untreated" showRelease={hasTriptan} />
      </section>
      {pinnedTreatment && pinnedSample && <section className="mw-rx-pane mw-rx-pinned" aria-label="Pinned binding site">
        <div className="mw-rx-pane-head">
          <h3>Pinned treatment</h3><span className="mw-rx-binding-state" role="status">
            {bindingStatus(pinnedTreatment.treatment, pinnedProgress, canEngage, false)}
          </span>
          <p>{pinnedName} at {pinnedTreatment.exposure}</p>
        </div>
        <CgrpBindingScene id={id + '-rx-pinned'} sample={pinnedSample}
          treatment={pinnedTreatment.treatment} progress={pinnedProgress} zoom={zoom} />
        <SignalReadout sample={pinnedSample} label="Pinned" showRelease={hasTriptan} />
      </section>}
      <section className="mw-rx-pane mw-rx-current" aria-label="Current binding site">
        <div className="mw-rx-pane-head">
          <h3>{pinnedTreatment ? 'Current treatment' : title}</h3>
          <span className="mw-rx-binding-state" role="status">{bindingState}</span>
          {pinnedTreatment && <p>{title} at {exposure}</p>}
        </div>
        <CgrpBindingScene id={id + '-rx-current'} sample={sample} treatment={treatment} progress={progress} zoom={zoom} />
        <SignalReadout sample={sample} label="Current" showRelease={hasTriptan} />
      </section>
    </div>

    <div className="mw-rx-key" aria-label="Binding site legend">
      <span title="Core receptor protein"><i data-part="clr" /> CLR</span>
      <span title="Receptor partner protein"><i data-part="ramp" /> RAMP1</span>
      <span><i data-part="cgrp" /> CGRP messenger</span>
      {hasTriptan && <span><i data-part="serotonin" /> Serotonin receptor on the releasing nerve</span>}
      {treated && <span><i data-part="drug" /> {title}</span>}
      {pinnedName && pinnedName !== title && <span><i data-part="drug" /> {pinnedName}</span>}
      <button type="button" className="mw-rx-scale" aria-pressed={magnified} onClick={() => setManualZoom(!magnified)}>
        <Icon name={magnified ? 'minus' : 'zoom'} size={15} /> {magnified ? 'Full view' : hasTriptan ? 'Magnify target' : 'Magnify pocket'}
      </button>
    </div>

    <div className="mw-rx-chart">
      <div className="mw-rx-chart-heading">
        <h3>Signal inside the cell</h3>
        <span>{delta === 0 ? 'Same signal' : Math.abs(delta) + (Math.abs(delta) === 1 ? ' point ' : ' points ') + (delta > 0 ? 'lower' : 'higher') + ' in current run'}</span>
      </div>
      <ComparisonTrace measure="cgrpSignal" untreated={controlEpisode.baseline} current={episode.treated} time={time} end={end}
        exposure={showTreatmentTime ? exposure : undefined} pinned={pinnedTreatment} />
      {!pinnedTreatment && <RunPlayback label="Binding" time={time} end={end} playing={playing} onPlay={onPlay} onScrub={onScrub} />}
      <div className="mw-rx-foot">
        <RunLegend extra={pinnedTreatment ? 'Pinned' : undefined}
          current="Current" showTreatmentTime={showTreatmentTime && exposure < end}
          multiple={Boolean(pinnedTreatment)} />
        <span>Model time</span>
      </div>
    </div>
    {!canAttack && <p className="mw-rx-low">{onBack ? 'Raise trigger intensity to see a response in the current run.' : 'The configured episode is below the attack threshold.'}</p>}
    <BindingSources treatments={pinnedTreatment?.treatment === 'sumatriptan' && treatment !== 'sumatriptan'
      ? [treatment, 'sumatriptan'] : [treatment]} />
  </section>
}
