import { useMemo } from 'react'
import { DURATION, STEP } from '../core/index.js'
import type { CortexFrame, PainPathwayFrame } from '../core/pathway.js'

export type ProbeRun = { cortex: readonly CortexFrame[]; pain: readonly PainPathwayFrame[]; changedAt: number }

const plots = [
  { label: 'Potassium', color: '#9c470f', dash: undefined },
  { label: 'Neuron activity', color: '#c16724', dash: '3 4' },
  { label: 'Blood flow', color: '#515f52', dash: '8 3' },
  { label: 'Free CGRP', color: '#883d26', dash: '9 3 2 3' },
  { label: 'Relay output', color: '#303a34', dash: undefined },
] as const

const left = 128
const right = 746
const spacing = 29
const xAt = (time: number) => left + time / DURATION * (right - left)
const floor = (index: number) => 36 + index * spacing

function tracePaths(run: ProbeRun, probe: number) {
  return plots.map((_, index) => run.cortex.map((frame, step) => {
    const cell = frame.cells[probe]
    const values = [cell.potassium, cell.state === 'wave' ? 1 : cell.state === 'quiet' ? 0 : .2,
      Math.max(0, Math.min(1, (cell.flow - .65) / .7)), run.pain[step].cgrp, run.pain[step].relay]
    return (step ? 'L' : 'M') + xAt(step * STEP).toFixed(1) + ' ' + (floor(index) - 19 * values[index]).toFixed(1)
  }).join(' '))
}

export function PathwayTraces({ id, run, previous, probe, time, aura }: {
  id: string; run: ProbeRun; previous?: ProbeRun; probe: number; time: number; aura: boolean
}) {
  const paths = useMemo(() => tracePaths(run, probe), [run, probe])
  const older = useMemo(() => previous && tracePaths(previous, probe), [previous, probe])
  const arrival = run.cortex.at(-1)!.cells[probe].ignitedAt
  const x = xAt(time)
  const reached = arrival >= 0 && arrival <= time
  return <section className="mp-traces" aria-labelledby={id + '-traces-title'}>
    <div className="mp-section-heading">
      <div><h3 id={id + '-traces-title'}>What the probe records</h3>
        <p>The upper traces follow the selected cell. CGRP and relay output follow the pain pathway.</p></div>
      <p className="mp-recording"><span />{time.toFixed(1)} model units</p>
    </div>
    <div className="mp-trace-scroll" tabIndex={0} aria-label="Probe chart">
      <svg viewBox="0 0 772 183" role="img" aria-label="Potassium, neuron activity, local blood flow, free CGRP and relay output on a shared model time axis">
        <defs>
          <clipPath id={id + '-trace-now'}><rect x={left} width={Math.max(0, x - left)} height="159" /></clipPath>
        </defs>
        {[0, 12, 24, 36, 48, 60, 72].map(t => <g key={t}>
          <path d={`M${xAt(t)} 10V156`} className="mp-trace-grid" />
          <text x={xAt(t)} y="172" textAnchor="middle">{t}</text>
        </g>)}
        {plots.map(({ label, color }, i) => <g key={label}>
          <path d={`M${left} ${floor(i)}H${right}`} className="mp-trace-grid" />
          <path d={`M5 ${floor(i)-9}h12`} stroke={color} strokeWidth="2" />
          <text x="24" y={floor(i) - 5}>{label}</text>
        </g>)}
        <g clipPath={`url(#${id}-trace-now)`} fill="none">
          {older && <g opacity=".42">
            {older.map((d, i) => <path key={i} d={d} stroke={plots[i].color} strokeWidth="1.65" strokeDasharray="3 4" />)}
          </g>}
          {paths.map((d, i) => <path key={i} d={d} stroke={plots[i].color} strokeWidth="1.8" strokeDasharray={plots[i].dash} />)}
        </g>
        {previous && previous.changedAt <= time && <path d={`M${xAt(previous.changedAt)} 9V154`} className="mp-change-line" />}
        {reached && <path d={`M${xAt(arrival)} 9V154`} className="mp-arrival-line" />}
        <path d={`M${x} 9V154`} className="mp-now-line" />
      </svg>
    </div>
    <div className="mp-trace-foot"><span>{reached ? `Wave reached the probe at ${arrival.toFixed(1)}` : aura ? 'The wave has yet to reach this probe' : 'Cortical wave off'}</span>
      <span>{previous ? 'Faint traces show the previous settings' : 'Model time'}</span></div>
  </section>
}
