import { useEffect, useMemo, useRef, useState } from 'react'
import { STEP, type Sample } from '../core/index.js'
import { cgrpReleaseLevel } from '../core/pathway.js'
import { Icon } from './icon.js'

export function TreatmentTimeKey({ multiple = false }: { multiple?: boolean }) {
  return <span><i className="mw-rx-dose-key" /> {multiple ? 'Treatment starts (dotted)' : 'Treatment starts'}</span>
}

export function ComparisonTrace({ untreated, current, time, end, measure, exposure, pinned, seriesNames }: {
  untreated: readonly Sample[]
  current: readonly Sample[]
  time: number
  end: number
  measure: 'cgrpSignal' | 'headache' | 'releasedCgrp'
  exposure?: number
  pinned?: { samples: readonly Sample[]; exposure: number }
  seriesNames?: { current: string; pinned: string }
}) {
  const pinnedSamples = pinned?.samples
  const paths = useMemo(() => {
    const trace = (samples: readonly Sample[]) => samples.slice(0, Math.floor(end / STEP) + 1).map((sample, index) =>
      (index ? 'L' : 'M') + (sample.time / end * 720).toFixed(1) + ' ' +
        (74 - (measure === 'releasedCgrp' ? cgrpReleaseLevel(sample.releasedCgrp) : sample[measure]) * 68).toFixed(1),
    ).join(' ')
    return { untreated: trace(untreated), current: trace(current), pinned: pinnedSamples && trace(pinnedSamples) }
  }, [untreated, current, pinnedSamples, end, measure])
  const marker = (at: number | undefined) => at === undefined || at < 0 || at >= end ? undefined : 720 * at / end
  const cursor = 720 * time / end
  const dose = marker(exposure)
  const pinnedDose = pinned?.exposure === exposure ? undefined : marker(pinned?.exposure)
  const label = measure === 'headache' ? 'Head pain' : measure === 'releasedCgrp' ? 'CGRP release' : 'CGRP cell signal'
  const description = label + ' on one model clock. Untreated is dashed, ' + (seriesNames?.current ?? 'current treatment') + ' is solid' +
    (pinned ? ', and ' + (seriesNames?.pinned ?? 'pinned treatment') + ' is dash-dot.' : '.') +
    (pinned && pinned.exposure === exposure ? ' Both treatments start at model time ' + exposure + '.' :
      (pinnedDose !== undefined ? ' ' + (seriesNames?.pinned ?? 'Pinned treatment') + ' starts at model time ' + pinned?.exposure + '.' : '') +
      (dose !== undefined ? ' ' + (seriesNames?.current ?? 'Current treatment') + ' starts at model time ' + exposure + '.' : ''))

  return <div className="mw-rx-plot">
    <div className="mw-rx-y-scale" aria-hidden="true"><span>100</span><span>50</span><span>0</span></div>
    <svg viewBox="0 0 720 80" preserveAspectRatio="none" role="img"
      aria-label={description}>
      <path d="M0 6H720M0 40H720M0 74H720M180 6V74M360 6V74M540 6V74" className="mw-rx-plot-grid" />
      {pinnedDose !== undefined && <line x1={pinnedDose} x2={pinnedDose} y1="4" y2="75" className="mw-rx-dose-line mw-rx-dose-pinned" />}
      {dose !== undefined && <line x1={dose} x2={dose} y1="4" y2="75" className="mw-rx-dose-line" />}
      <path d={paths.current} className="mw-rx-plot-line" />
      {paths.pinned && <path d={paths.pinned} className="mw-rx-plot-line mw-rx-plot-pinned" />}
      <path d={paths.untreated} className="mw-rx-plot-line mw-rx-plot-control" />
      <line x1={cursor} x2={cursor} y1="2" y2="78" className="mw-rx-playhead" />
    </svg>
  </div>
}

export function RunLegend({ extra, current, showTreatmentTime, multiple }: {
  extra?: string
  current: string
  showTreatmentTime: boolean
  multiple: boolean
}) {
  return <div className="mw-legend"><span><i className="mw-pin-line" /> Untreated</span>
    {extra && <span><i className="mw-compare-pin-line" /> {extra}</span>}
    <span><i /> {current}</span>
    {showTreatmentTime && <TreatmentTimeKey multiple={multiple} />}
  </div>
}

type PlaybackProps = {
  label: 'Binding' | 'Head pain' | 'Treatment comparison'
  time: number
  end: number
  playing: boolean
  onPlay?: () => void
  onStep?: () => void
  onScrub: (time: number) => void
}

export type ComparisonLane = {
  run: 'untreated' | 'pinned' | 'current'
  label: string
  milestones: readonly {
    kind: 'target' | 'relay' | 'pain' | 'relay-and-pain'
    label: string
    time: number
  }[]
}

const milestoneIcons = { target: 'receptor', relay: 'cells', pain: 'check', 'relay-and-pain': 'check' } as const

export function CgrpTraces({ untreated, current, triptan, exposure, time, end }: {
  untreated: readonly Sample[]
  current: readonly Sample[]
  triptan: { samples: readonly Sample[]; exposure: number }
  exposure: number
  time: number
  end: number
}) {
  const seriesNames = { current: 'Ubrogepant', pinned: 'Sumatriptan' }
  return <div className="mw-cgrp-traces">
    <div>
      <h3>CGRP released by the nerve</h3>
      <ComparisonTrace measure="releasedCgrp" untreated={untreated} current={current} pinned={triptan}
        time={time} end={end} exposure={exposure} seriesNames={seriesNames} />
    </div>
    <div>
      <h3>Signal inside the receiving cell</h3>
      <ComparisonTrace measure="cgrpSignal" untreated={untreated} current={current} pinned={triptan}
        time={time} end={end} exposure={exposure} seriesNames={seriesNames} />
    </div>
  </div>
}

function splitMilestones(events: ComparisonLane['milestones'], end: number, width: number) {
  const rows: (typeof events[number])[][] = [[]]
  for (const event of events.filter(event => event.time >= 0 && event.time <= end).sort((a, b) => a.time - b.time)) {
    const previous = rows.find(row => !row.length || (event.time - row[row.length - 1].time) / end * width >= 50)
    if (previous) previous.push(event)
    else rows.push([event])
  }
  return rows
}

export function MilestoneTimeline({ lanes, time, end, playing, onScrub }: Pick<PlaybackProps, 'time' | 'end' | 'playing' | 'onScrub'> & {
  lanes: readonly ComparisonLane[]
}) {
  const lanesRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [selected, setSelected] = useState<string>()
  useEffect(() => {
    const track = lanesRef.current?.querySelector('.mw-milestone-track')
    if (!track) return
    const measure = () => setWidth(track.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [])

  const inspected = !playing && lanes.flatMap(lane => lane.milestones.map(event => ({ lane, event }))).find(({ lane, event }) =>
    selected === lane.run + '-' + event.kind && Math.abs(time - event.time) < .005)

  return <div className="mw-milestone-timeline" role="group" aria-label="Shared timeline milestones">
    <div className="mw-milestone-heading">
      <strong>Timeline milestones</strong>
      <span><Icon name="receptor" size={14} /> Target reached</span>
      <span><Icon name="cells" size={14} /> Brainstem quiet</span>
      <span><Icon name="check" size={14} /> Pain settles</span>
    </div>
    <div className="mw-milestone-lanes" ref={lanesRef}>
      <div className="mw-milestone-axis" aria-hidden="true">
        {[0, .25, .5, .75, 1].map(fraction => <span key={fraction}>{Math.round(end * fraction)}</span>)}
      </div>
      {lanes.map(lane => {
        const rows = splitMilestones(lane.milestones, end, width)
        return <div className="mw-milestone-lane" data-run={lane.run} key={lane.run}>
          <span className="mw-milestone-run">{lane.label}</span>
          <div className="mw-milestone-tracks">
            {rows.map((events, index) => <div className="mw-milestone-track" key={index}>
              {events.map(event => <button type="button" key={event.kind}
                className="mw-milestone" data-milestone={event.kind} data-time={event.time}
                aria-label={lane.label + ' · ' + event.label + ' at model time ' + event.time}
                aria-current={inspected && inspected.lane.run === lane.run && inspected.event.kind === event.kind ? 'time' : undefined}
                style={{ left: 100 * event.time / end + '%' }}
                title={event.label + ' · ' + event.time}
                onClick={() => {
                  setSelected(lane.run + '-' + event.kind)
                  onScrub(event.time)
                }}>
                <Icon name={milestoneIcons[event.kind]} size={15} />
                {event.time}
              </button>)}
            </div>)}
            <i className="mw-milestone-cursor" style={{ left: 100 * time / end + '%' }} aria-hidden="true" />
          </div>
        </div>
      })}
    </div>
    <p className="mw-milestone-selection" role="status">
      {inspected ? <><strong>{inspected.lane.label}</strong> · {inspected.event.label} at {inspected.event.time}</> :
        'Select a milestone to pause all runs at that time.'}
    </p>
  </div>
}

export function ComparisonClock({ milestones, ...props }: PlaybackProps & { milestones?: readonly ComparisonLane[] }) {
  return <div className="mw-comparison-clock">
    <span>Shared model time</span>
    <RunPlayback {...props} />
    {milestones && <MilestoneTimeline lanes={milestones} {...props} />}
  </div>
}

export function RunPlayback({ label, time, end, playing, onPlay, onStep, onScrub }: PlaybackProps) {
  const action = playing ? 'Pause' : time >= end ? 'Replay' : 'Play'
  const frame = Math.round(time / STEP) * STEP
  return <div className="mw-rx-transport">
    {onPlay && <button type="button" className="mw-rx-play" aria-label={action + ' ' + label.toLowerCase() + ' playback'} onClick={onPlay}>
      <Icon name={playing ? 'pause' : time >= end ? 'reset' : 'play'} size={15} /> {action}
    </button>}
    {onStep && <button type="button" className="mw-rx-play mw-rx-step" onClick={onStep} disabled={time >= end}>Next moment</button>}
    <input aria-label={label + ' playback position'} aria-valuetext={frame + ' model time units'} type="range"
      min={0} max={end} step={STEP} value={frame}
      onChange={event => onScrub(event.currentTarget.valueAsNumber)} />
    <span>{frame.toFixed(2)} / {end}</span>
  </div>
}
