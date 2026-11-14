import { useMemo, type ReactNode } from 'react'
import { DURATION, STEP, isAuraActive, type Intervention, type Sample } from '../core/index.js'
import { anatomyViews, type AnatomyView } from './HeadCutaway.js'
import { Icon } from './icon.js'
import { nerveStrength, type workbenchTraces } from './workbench-episode.js'

type Traces = ReturnType<typeof workbenchTraces>
type RunFrame = { sample: Sample; nerve: Sample; treatment: Intervention; traces: Traces; canAttack: boolean }
type TreatmentReference = { sample: Sample; treatment: Intervention; label: string }

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const units = (value: number) => Math.round(clamp(value) * 100)
const cycle = (value: number) => value - Math.floor(value)
const symptoms = [
  { key: 'headache', label: 'Head pain' },
  { key: 'lightSensitivity', label: 'Light sensitivity' },
  { key: 'nausea', label: 'Nausea' },
] as const

function Panel({ id, view, focused, highlighted, note, children }: {
  id: string; view: AnatomyView; focused?: AnatomyView; highlighted: readonly AnatomyView[]; note?: ReactNode; children: ReactNode
}) {
  return <section className="mw-view" data-view={view} data-focused={focused === view}
    data-adjusted={highlighted.includes(view) || undefined} id={id + '-' + view} aria-labelledby={id + '-' + view + '-title'} tabIndex={-1}>
    <header className="mw-view-head">
      <h3 id={id + '-' + view + '-title'}>{anatomyViews[view].name}</h3>{note && <span>{note}</span>}
    </header>
    {children}
  </section>
}

function SignalTrace({ values, pinned, time, label }: {
  values: readonly number[]; pinned?: readonly number[]; time?: number; label: string
}) {
  const paths = useMemo(() => {
    function trace(points: readonly number[]) {
      return points.map((value, index) =>
        (index ? 'L' : 'M') + (3 + index * STEP / DURATION * 234).toFixed(2) + ' ' + (55 - clamp(value) * 48).toFixed(2),
      ).join(' ')
    }
    return { current: trace(values), pinned: pinned && trace(pinned) }
  }, [values, pinned])
  const marker = time === undefined ? undefined : 3 + time / DURATION * 234
  return <svg viewBox="0 0 240 61" preserveAspectRatio="none" className="mw-trace" role="img" aria-label={label}>
    <path d="M3 7H237M3 31H237M3 55H237M61.5 7V55M120 7V55M178.5 7V55" className="mw-trace-grid" />
    <path d={paths.current} className="mw-trace-curve" />
    {paths.pinned && <path d={paths.pinned} className="mw-trace-pinned" />}
    {marker !== undefined && <line x1={marker} x2={marker} y1="4" y2="57" className="mw-trace-now" />}
  </svg>
}

function Brain({ sample, enabled }: { sample: Sample; enabled: boolean }) {
  const active = isAuraActive(sample)
  const segments = 24
  return <>
    <p className="mw-panel-state">{active ? 'Wave spreading' : !enabled ? 'Aura switched off' : 'Cortex quiet'}</p>
    <div className="mw-wave-track" aria-hidden="true">
      {Array.from({ length: segments }, (_, index) => {
        const position = (index + 0.5) / segments
        const wave = active && position <= sample.auraFront && position >= sample.auraWake
        return <i key={index} data-wave={wave} style={{ height: 5 + Math.sin(index / 4) ** 2 * 8 }} />
      })}
    </div>
    <p className="mw-panel-copy">A wave in the visual cortex can accompany aura.</p>
  </>
}

function Nerve({ current, pinned, seek }: {
  current: RunFrame; pinned?: RunFrame; seek: (time: number, view: AnatomyView) => void
}) {
  const peak = units(current.traces.nervePeak)
  const pinnedPeak = pinned && units(pinned.traces.nervePeak)
  const pinnedTrace = pinned?.traces.nerve
  const overlapping = useMemo(() => pinnedTrace && current.traces.nerve.every((value, index) => value === pinnedTrace[index]),
    [pinnedTrace, current.traces.nerve])
  return <>
    <div className="mw-number-row">
      <div><output aria-label="Current nerve strength" aria-live="off">{units(nerveStrength(current.nerve))}</output><span> / 100 now</span></div>
      {pinned && <span className="mw-pinned-value">Pinned <output aria-label="Pinned nerve strength" aria-live="off">{units(nerveStrength(pinned.nerve))}</output></span>}
    </div>
    <SignalTrace values={current.traces.nerve} pinned={pinnedTrace} time={current.sample.time}
      label="Nerve strength through the episode. Solid line is current. The dashed line shows the pinned run when present." />
    <div className="mw-trace-caption">
      <span>Peak <strong>{peak}</strong>{pinnedPeak !== undefined && <> · Pinned <strong>{pinnedPeak}</strong></>}</span>
      {overlapping && <strong>Same curve</strong>}
    </div>
    {peak > 0 && <button type="button" className="text-button mw-effect" onClick={() => seek(current.traces.nervePeakTime, 'nerve')}>
      See nerve peak <Icon name="arrow" size={14} />
    </button>}
  </>
}

function Vessel({ sample, pinned }: { sample: Sample; pinned?: Sample }) {
  const tone = clamp(sample.cgrpSignal * 1.8)
  const pinTone = pinned && clamp(pinned.cgrpSignal * 1.8)
  return <>
    <svg viewBox="0 0 204 70" className="mw-vessel-art" role="img" aria-label="Modeled meningeal artery and its cross section">
      <path d="M5 52C31 49 47 18 80 25C107 31 111 42 139 31" fill="none" stroke="#351d23" strokeWidth={15 + tone * 16} strokeLinecap="round" />
      <path d="M5 52C31 49 47 18 80 25C107 31 111 42 139 31" fill="none" stroke="#b05d55" strokeWidth={10 + tone * 14} strokeLinecap="round" />
      <path d="M5 52C31 49 47 18 80 25C107 31 111 42 139 31" fill="none" stroke="#431f28" strokeWidth={6 + tone * 10} strokeLinecap="round" />
      <path d="M5 52C31 49 47 18 80 25C107 31 111 42 139 31" pathLength="100" fill="none" stroke="#efa489"
        strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 13" strokeDashoffset={-sample.time * 7} />
      <circle cx="177" cy="34" r={11 + tone * 11} fill="#552c32" stroke="#c87969" strokeWidth="3.5" />
      <circle cx="177" cy="34" r="11" fill="none" stroke="#e5aa91" strokeOpacity=".55" />
      {pinTone !== undefined && <circle cx="177" cy="34" r={12.5 + pinTone * 11} fill="none" stroke="#bfd3b0" strokeWidth="1.5" strokeDasharray="2 3" />}
    </svg>
    <p className="mw-panel-copy">CGRP widens this modeled artery.</p>
  </>
}

export function MigraineVision({ id, sample, enabled }: { id: string; sample: Sample; enabled: boolean }) {
  const active = isAuraActive(sample)
  const glare = sample.lightSensitivity
  const front = clamp(sample.auraFront)
  const radius = 9 + front * 87
  const cx = 133 + front * 39
  const edge = Array.from({ length: 49 }, (_, i) => {
    const angle = -1.94 + i * 0.063
    const r = radius + (i % 2 ? 3.9 : 0)
    return (i ? 'L' : 'M') + (cx + Math.cos(angle) * r).toFixed(1) + ' ' + (57 + Math.sin(angle) * r * 0.76).toFixed(1)
  }).join(' ')
  const shadow = edge + ` Q${cx + radius * 0.22} 59 ${cx - radius * 0.08} ${57 - radius * 0.49}Z`
  return <div className="mw-vision-picture" role="img" aria-label={'Her view of a street crossing' + (active ? ' with an expanding aura and blurred patch' : glare > 0.025 ? ' with glare' : '')}>
    <svg viewBox="0 0 300 100" aria-hidden="true">
      <defs>
        <clipPath id={id + '-scotoma'}><path d={shadow} /></clipPath>
        <radialGradient id={id + '-vision-glare'} cx=".64" cy=".14" r=".84">
          <stop stopColor="#faf2d3" /><stop offset="1" stopColor="#f2ddbe" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="300" height="100" fill={'url(#' + id + '-vision-glare)'} opacity={glare * 0.96} />
      {active && enabled && <g opacity={Math.min(1, sample.auraFront * 10) * (1 - clamp(sample.auraWake) * 0.64)}>
        <g clipPath={'url(#' + id + '-scotoma)'}>
          <foreignObject width="300" height="100"><div className="mw-scotoma-picture" /></foreignObject>
          <path d={shadow} fill="#312b40" opacity=".42" />
        </g>
        <path d={edge} fill="none" stroke="#ad94e1" strokeWidth="7" opacity=".62" strokeLinejoin="round" />
        <path d={edge} fill="none" stroke="#fff1c9" strokeWidth="2" strokeLinejoin="round" />
      </g>}
    </svg>
  </div>
}

const membrane = Array.from({ length: 15 }, (_, index) => 4 + index * 9)
const spiral = 'M62 45c-8-2-14 3-12 9s11 5 13 1s-4-6-7-3'

function ReceptorArt({ sample, treatment }: { sample: Sample; treatment: Intervention }) {
  const activation = clamp(sample.cgrpSignal * 1.4)
  const drug = clamp(sample.engagement * 1.6)
  const blocked = treatment === 'ubrogepant' ? drug : 0
  const captured = treatment === 'galcanezumab' ? drug : 0
  const occupied = clamp(sample.cgrpOccupied * 1.4)
  const free = clamp(sample.freeCgrp * 1.5 + sample.releasedCgrp * 0.16)
  return <svg viewBox="0 0 135 88" className="mw-receptor-art" role="img"
    aria-label={blocked > 0.05 ? 'Ubrogepant at the receptor' : captured > 0.05 ? 'Antibody binding free CGRP' : 'CGRP approaching the receptor'}>
    <path d="M0 57H135V70H0Z" fill="#43483a" />
    <g stroke="#a09671" fill="#ccb88a" strokeWidth=".7" opacity=".64">
      {membrane.map(x => <g key={x}><path d={`M${x} 57v6m2 7v-6`} /><circle cx={x} cy="56" r="1.7" /><circle cx={x + 2} cy="70" r="1.7" /></g>)}
    </g>
    <path d="M54 50c-13-2-20-15-14-20c3-3 11 1 15 7c5 7 9 7 14 8l9 11-3 17H63l-3-13Z" fill="#8d805d" stroke="#d1c095" strokeWidth="1.3" />
    <path d="M75 42c3-8 9-13 16-13c4 0 8 5 4 11c-4 7-12 8-13 15l4 18H73l-7-14c-2-4 3-9 9-17Z" fill="#a98e65" stroke="#dfc398" strokeWidth="1.3" />
    <path d="M67 56v13m5-16c-4 4-4 9 3 17m3-18c-5 5-5 10 2 18" fill="none" stroke="#504b3c" strokeWidth="1.35" />
    <path d={spiral} transform="translate(0 -13)" fill="none" stroke="#e9b36c" strokeWidth="2.8" strokeLinecap="round" opacity={occupied} />
    {Array.from({ length: 7 }, (_, i) => {
      const progress = cycle(i * .211 + sample.time * .13)
      const x = 13 + i * 11 + Math.sin(i * 2.1 + progress * 2.5) * 12
      const y = 6 + progress * 32
      return <path key={i} d={`M${x} ${y}q3 -4 6 -1t4 0`} stroke="#f4c778" fill="none" strokeWidth="2.3"
        strokeLinecap="round" opacity={free * (0.5 + 0.5 * Math.sin(progress * Math.PI))} />
    })}
    {blocked > 0.012 && <g opacity={blocked} transform={`translate(${(1 - blocked) * 17} ${(blocked - 1) * 15})`}>
      <path d="m58 38 5-6h8l4 6-5 6h-8Z" fill="#bfe4ca" stroke="#ecf6d8" strokeWidth="1.2" />
      <path d="m75 38 4 2" stroke="#e5f2d0" strokeWidth="2" strokeLinecap="round" />
    </g>}
    {captured > 0.012 && <g opacity={captured} strokeLinecap="round">
      <path d="M32 33V22m0 0-6-6m6 6 7-7" fill="none" stroke="#bfe4ca" strokeWidth="2.8" />
      <path d="M21 16q3-4 6-2l2 3m7-4q2-3 5-2l2 2" fill="none" stroke="#f4c778" strokeWidth="2" />
    </g>}
    <path d="M72 74c2 8 15 9 29 9" fill="none" stroke="#806e4d" strokeWidth="2" />
    <path d="M72 74c2 8 15 9 29 9" fill="none" stroke="#ffda91" pathLength="100"
      strokeDasharray={`${7 + 48 * activation} 100`} strokeDashoffset={-cycle(sample.time * .34) * 95}
      strokeWidth={1 + activation * 3} strokeLinecap="round" opacity={activation} />
  </svg>
}

function Receptor({ current, reference, untreated, effectTime, showEffect, openBinding }: {
  current: RunFrame; reference?: TreatmentReference; untreated: Sample; effectTime?: number; showEffect: (time: number) => void
  openBinding: (opener: HTMLButtonElement) => void
}) {
  const { sample, treatment } = current
  const signal = units(sample.cgrpSignal)
  const change = reference ? signal - units(reference.sample.cgrpSignal) : 0
  const drugEffect = units(untreated.cgrpSignal) - signal
  const showMatchedEffect = reference?.label === 'Pinned' && treatment !== 'none' && drugEffect !== -change
  const difference = change === 0 ? 'Same signal' : change < 0 ? `${-change} lower` : `${change} higher`
  const mechanism = treatment === 'ubrogepant' ? 'Ubrogepant blocks the receptor.'
    : treatment === 'galcanezumab' ? 'Galcanezumab binds CGRP before it reaches the receptor.'
      : 'CGRP binds and sends a signal into the cell.'
  return <>
    <div className="mw-receptor-pair" data-compare={Boolean(reference)}>
      {reference && <div className="mw-receptor-reference">
        <span>{reference.label}</span><ReceptorArt sample={reference.sample} treatment={reference.treatment} />
        <output aria-label={reference.label + ' CGRP signal'} aria-live="off">{units(reference.sample.cgrpSignal)}</output>
      </div>}
      <div>
        <span>{reference ? 'Current' : 'Receptor close-up'}</span><ReceptorArt sample={sample} treatment={treatment} />
        <output aria-label="Current CGRP signal" aria-live="off">{signal}</output>
      </div>
    </div>
    <div className="mw-trace-caption">
      <span>CGRP cell signal</span>{reference && <strong aria-label="CGRP signal difference">{difference}</strong>}
    </div>
    <p className="mw-panel-copy">{mechanism}</p>
    {showMatchedEffect && <p className="mw-panel-copy mw-drug-comparison">
      {drugEffect > 0 ? `Drug effect in this run: ${drugEffect} lower than untreated.` : 'The drug has no visible effect on this run yet.'}
    </p>}
    <div className="mw-receptor-actions">
      <button type="button" className="text-button mw-effect" onClick={event => openBinding(event.currentTarget)}>
        <Icon name="zoom" size={14} /> Zoom into binding site
      </button>
      {effectTime !== undefined && <button type="button" className="text-button mw-effect" onClick={() => showEffect(effectTime)}>
        See peak drug effect <Icon name="arrow" size={14} />
      </button>}
    </div>
  </>
}

function settleLabel(run: RunFrame) {
  if (!run.canAttack) return 'No attack'
  return run.traces.settlingTime === undefined ? 'Past model end' : Math.ceil(run.traces.settlingTime) + ' units'
}

function Symptoms({ current, pinned }: { current: RunFrame; pinned?: RunFrame }) {
  const currentSettle = current.traces.settlingTime
  const pinnedSettle = pinned?.traces.settlingTime
  const delta = currentSettle !== undefined && pinnedSettle !== undefined && current.canAttack && pinned?.canAttack
    ? Math.ceil(currentSettle) - Math.ceil(pinnedSettle) : undefined
  return <>
    <dl className="mw-symptoms">
      {symptoms.map(({ key, label }) => <div key={key}>
        <dt>{label}</dt><dd>{units(current.sample[key])}</dd>
        <meter min="0" max="100" value={units(current.sample[key])} aria-label={label + ' in model units'} />
        {pinned && <span className="mw-reference" style={{ left: units(pinned.sample[key]) + '%' }} title={'Pinned ' + units(pinned.sample[key])} />}
      </div>)}
    </dl>
    <SignalTrace values={current.traces.headache} pinned={pinned?.traces.headache} time={current.sample.time}
      label="Head pain through the episode. Solid line is current. The dashed line shows the pinned run when present." />
    <div className="mw-trace-caption mw-settle">
      <span>Time to settle <strong aria-label="Current time to settle">{settleLabel(current)}</strong></span>
      {pinned && <span>Pinned <strong aria-label="Pinned time to settle">{settleLabel(pinned)}</strong></span>}
      {delta !== undefined && delta !== 0 && <strong className="mw-settle-delta">{Math.abs(delta)} {Math.abs(delta) === 1 ? 'unit' : 'units'} {delta < 0 ? 'sooner' : 'later'}</strong>}
    </div>
  </>
}

export function MigraineViews({ id, current, pinned, untreated, auraEnabled, focused, highlighted, effectTime, seek, openBinding, openPathway }: {
  id: string; current: RunFrame; pinned?: RunFrame; untreated: Sample; auraEnabled: boolean; focused?: AnatomyView;
  highlighted: readonly AnatomyView[]; effectTime?: number; seek: (time: number, view: AnatomyView) => void
  openBinding: (opener: HTMLButtonElement) => void
  openPathway: (opener: HTMLButtonElement) => void
}) {
  const panel = { id, focused, highlighted }
  const { sample } = current
  const reference = pinned ? { sample: pinned.sample, treatment: pinned.treatment, label: 'Pinned' }
    : current.treatment === 'none' ? undefined : { sample: untreated, treatment: 'none' as const, label: 'Untreated' }
  return <>
    <Panel {...panel} view="brain" note="Visual cortex">
      <Brain sample={sample} enabled={auraEnabled} />
      <button type="button" className="text-button mw-effect" onClick={event => openPathway(event.currentTarget)}>
        Cortex experiment <Icon name="arrow" size={14} />
      </button>
    </Panel>
    <Panel {...panel} view="vision" note={isAuraActive(sample) ? 'Aura visible' : sample.lightSensitivity > 0.025 ? 'Glare' : 'Clear field'}>
      <MigraineVision id={id} sample={sample} enabled={auraEnabled} />
    </Panel>
    <Panel {...panel} view="nerve" note="Signal strength"><Nerve current={current} pinned={pinned} seek={seek} /></Panel>
    <Panel {...panel} view="receptor"><Receptor current={current} reference={reference} untreated={untreated} effectTime={effectTime}
      showEffect={time => seek(time, 'receptor')} openBinding={openBinding} /></Panel>
    <Panel {...panel} view="vessel" note="Meningeal artery"><Vessel sample={sample} pinned={pinned?.sample} /></Panel>
    <Panel {...panel} view="symptoms" note="Head-pain recovery"><Symptoms current={current} pinned={pinned} /></Panel>
  </>
}
