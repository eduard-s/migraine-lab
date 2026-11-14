import { useMemo } from 'react'
import { DURATION, sampleAt, type EpisodeComparison, type Pathway, type Sample } from '../core/index.js'

const percent = (value: number) => Math.round(value * 100)
const signalKey = (pathway: Pathway) => pathway === 'cgrp' ? 'cgrpSignal' : 'pacapSignal'
const x = (time: number) => 34 + time / DURATION * 380
const y = (value: number) => 112 - value * 94

export function Readouts({ episode, sample, pathway, setPathway }: {
  episode: EpisodeComparison
  sample: Sample
  pathway: Pathway
  setPathway: (pathway: Pathway) => void
}) {
  const active = episode.treatment !== 'none'
  const signal = signalKey(pathway)
  const base = sampleAt(episode.baseline, sample.time)
  const treated = sampleAt(episode.treated, sample.time)
  const channel = pathway === 'cgrp' ? 'CGRP' : 'PACAP'
  const paths = useMemo(() => {
    function path(samples: Sample[]) {
      return samples.map((row, index) => (index ? 'L' : 'M') + x(row.time).toFixed(1) + ' ' + y(row[signal]).toFixed(1)).join(' ')
    }
    return [path(episode.baseline), active ? path(episode.treated) : '']
  }, [episode, active, signal])
  return (
    <div className="readouts">
      <section className="symptom-readout" aria-label="Symptoms in the current view">
        <h3>Modeled symptoms</h3>
        <p className="field-note">Relative levels at this moment</p>
        {([
          ['Head pain', sample.headache],
          ['Light sensitivity', sample.lightSensitivity],
          ['Nausea', sample.nausea],
        ] as const).map(([name, value]) => (
          <div className="symptom" key={name}>
            <span>{name}</span><output aria-label={name}>{percent(value)}</output>
            <meter min={0} max={100} value={percent(value)} aria-label={name} />
          </div>
        ))}
      </section>
      <section className="signal-readout" aria-label="Cell signaling comparison">
        <div className="trace-heading">
          <div><h3>Cell signaling</h3><p className="field-note">Relative response across the episode</p></div>
          <div className="subview" aria-label="Signal to plot">
            <button type="button" aria-pressed={pathway === 'cgrp'} onClick={() => setPathway('cgrp')}>CGRP</button>
            <button type="button" aria-pressed={pathway === 'pacap'} onClick={() => setPathway('pacap')}>PACAP</button>
          </div>
        </div>
        <div className="trace">
          <svg viewBox="0 0 428 138" role="img" aria-label={channel + ' response at this moment. Untreated ' + percent(base[signal]) + (active ? ', treated ' + percent(treated[signal]) : '') + ' relative units.'}>
            {[0, 0.5, 1].map(value => <g key={value} className="trace-grid">
              <line x1="34" x2="414" y1={y(value)} y2={y(value)} /><text x="28" y={y(value) + 3} textAnchor="end">{value * 100}</text>
            </g>)}
            {[0, 18, 36, 54, 72].map(value => <text key={value} x={x(value)} y="128" textAnchor="middle">{value}</text>)}
            {active && <line x1={x(episode.factors.start)} x2={x(episode.factors.start)} y1="14" y2="112" className="trace-treatment" />}
            <line x1={x(sample.time)} x2={x(sample.time)} y1="14" y2="112" className="trace-cursor" />
            <path d={paths[0]} className="trace-baseline" />
            {active && <path d={paths[1]} className={'trace-compare ' + pathway} />}
            <circle cx={x(sample.time)} cy={y(base[signal])} r="3.2" className="trace-dot" />
            {active && <circle cx={x(sample.time)} cy={y(treated[signal])} r="3.2" className={'trace-dot ' + pathway} />}
          </svg>
          <div className="trace-legend">
            <span><i className="line-key reference" /> Untreated <strong>{percent(base[signal])}</strong></span>
            {active && <span><i className={'line-key ' + pathway} /> With treatment <strong>{percent(treated[signal])}</strong></span>}
          </div>
        </div>
        <dl className="readings">
          <div><dt>{channel} released</dt><dd>{(pathway === 'cgrp' ? sample.releasedCgrp : sample.releasedPacap).toFixed(2)}</dd></div>
          <div><dt>Free messenger</dt><dd>{(pathway === 'cgrp' ? sample.freeCgrp : sample.freePacap).toFixed(2)}</dd></div>
          <div><dt>Receptors active</dt><dd>{percent(pathway === 'cgrp' ? sample.cgrpOccupied : sample.pac1Occupied)}%</dd></div>
        </dl>
      </section>
    </div>
  )
}
