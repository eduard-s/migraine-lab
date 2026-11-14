import type { MouseEvent } from 'react'
import { STEP, type Sample } from '../core/index.js'
import type { PainPathwayFrame } from '../core/pathway.js'
import { HeadCutaway } from './HeadCutaway.js'
import { Icon } from './icon.js'
import type { Station } from './pathway-content.js'

const bounds = { x: 0, y: 20, width: 520, height: 380 }
export const recoveryViewBox = '0 0 520 400'
export const VISIBLE_PULSE_LEVEL = 0.025

// The lateral cutaway projects deeper structures onto the surface of the illustration.
const sites = [
  { id: 'cortex', name: 'Visual cortex', x: 118, y: 206, labelX: 88, labelY: 252, leader: 'M118 206L98 242 88 252' },
  { id: 'meninges', name: 'Meninges', x: 305, y: 77, labelX: 383, labelY: 58, leader: 'M305 77L342 58H383' },
  { id: 'relay', name: 'Brainstem relay', x: 210, y: 279, labelX: 116, labelY: 325, leader: 'M210 279L162 325H116' },
  { id: 'thalamus', name: 'Thalamus', x: 245, y: 170, labelX: 410, labelY: 146, leader: 'M245 170L308 146H410' },
] as const

const ending = sites[1]
const relaySite = sites[2]
const thalamusSite = sites[3]
const recoverySites = [
  { ...ending, label: 'Meninges', width: 144, labelX: 394, labelY: 64, leader: 'M305 77L343 64H394' },
  { ...relaySite, label: 'Brainstem', width: 145, labelX: 104, labelY: 330, leader: 'M210 279L173 330H104' },
  { ...thalamusSite, label: 'Thalamus', width: 144, labelX: 404, labelY: 155, leader: 'M245 170L308 155H404' },
] as const
const possibleLink = 'M118 206C102 153 153 114 206 99Q262 82 305 77'
const meningealFibre = 'M305 77C302 102 273 110 280 142S309 208 254 235C229 230 218 243 216 256L210 279'
const ascendingFibre = 'M210 279C188 263 180 247 190 222S221 182 245 170'
const unit = (value: number) => Math.max(0, Math.min(1, value))
const mapLabel = 'Woman’s head cutaway locating the visual cortex, meninges, brainstem relay, and thalamus.'

export type PathwayTimes = Record<'meninges' | 'relay' | 'thalamus', number>

function pulseSpacing(travelTime: number) {
  return Math.min(1.5, travelTime * .5)
}

export function pathwaySignalAt(frames: readonly PainPathwayFrame[], time: number, signal: 'incoming' | 'relay' | 'thalamus') {
  const position = Math.max(0, Math.min(frames.length - 1, time / STEP))
  const index = Math.floor(position)
  const first = frames[index][signal]
  const next = frames[Math.min(index + 1, frames.length - 1)][signal]
  return first + (next - first) * (position - index)
}

export function brainstemQuietAt(frames: readonly PainPathwayFrame[], times: PathwayTimes, end: number) {
  let lastActive: number | undefined
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].relay < VISIBLE_PULSE_LEVEL) continue
    lastActive = frames[i].time
    break
  }
  if (lastActive === undefined) return undefined

  // Let the last pulse already on its way to the thalamus clear the drawing.
  const start = times.relay - .25
  const travelTime = times.thalamus - start
  const spacing = pulseSpacing(travelTime)
  for (let launch = start; launch <= end; launch += spacing) {
    if (pathwaySignalAt(frames, launch, 'relay') >= VISIBLE_PULSE_LEVEL) lastActive = Math.max(lastActive, launch + travelTime)
  }
  const quietAt = (Math.floor(lastActive / STEP) + 1) * STEP
  return quietAt <= end ? quietAt : undefined
}

function NerveRoute({ name, path, time, start, arrival, frames, signal }: {
  name: 'trigeminal' | 'ascending'
  path: string
  time: number
  start: number
  arrival: number
  frames: readonly PainPathwayFrame[]
  signal: 'incoming' | 'relay'
}) {
  const travelTime = arrival - start
  const spacing = pulseSpacing(travelTime)
  const latest = Math.floor((time - start) / spacing)
  const levelNow = pathwaySignalAt(frames, time, signal)

  return <g className="mp-map-route" data-signal={name}>
    <path className="mp-map-track" d={path} />
    <path className="mp-map-current" d={path} opacity={.18 + .72 * levelNow} />
    {Array.from({ length: Math.ceil(travelTime / spacing) }, (_, i) => latest - i).map(sequence => {
      if (sequence < 0) return null
      const launched = start + sequence * spacing
      const travel = (time - launched) / travelTime
      const level = pathwaySignalAt(frames, launched, signal)
      if (travel < 0 || travel > 1 || level < VISIBLE_PULSE_LEVEL) return null
      const opacity = unit(.12 + 1.3 * level)
      const length = 6 + 18 * level
      const dashOffset = 11 - travel * 111
      return <g key={sequence} data-pulse={name} data-progress={travel.toFixed(3)} opacity={opacity}>
        <path d={path} pathLength={100} className="mp-map-pulse-glow" strokeWidth={4 + 6 * level}
          strokeDasharray={`${length} 130`} strokeDashoffset={dashOffset} />
        <path d={path} pathLength={100} className="mp-map-pulse" strokeWidth={1.2 + 3 * level}
          strokeDasharray={`${length} 130`} strokeDashoffset={dashOffset} />
      </g>
    })}
  </g>
}

function PathwayNerves({ time, frames, times, active }: {
  time: number
  frames: readonly PainPathwayFrame[]
  times: PathwayTimes
  active?: Station | 'binding'
}) {
  const relay = pathwaySignalAt(frames, time, 'relay')
  const thalamus = pathwaySignalAt(frames, time, 'thalamus')

  return <g className="mp-map-nerves">
    <path className="mp-map-dura" d="M99 187C107 141 135 105 181 87C219 71 269 64 305 77C340 86 364 106 381 135" />
    <path className="mp-map-region" data-active={active === 'relay'}
      d="M217 228C233 236 236 248 227 261L216 293Q210 299 202 291L203 269C191 256 200 234 217 228Z" />
    <path className="mp-map-region" data-active={active === 'thalamus'}
      d="M224 164C229 151 254 148 270 160C281 171 266 183 250 188C236 191 218 178 224 164Z" />
    <NerveRoute name="trigeminal" path={meningealFibre} time={time} start={times.meninges - .5} arrival={times.relay}
      frames={frames} signal="incoming" />
    <NerveRoute name="ascending" path={ascendingFibre} time={time} start={times.relay - .25} arrival={times.thalamus}
      frames={frames} signal="relay" />
    <circle className="mp-map-ganglion" cx="254" cy="235" r="4.5" />
    <circle className="mp-map-response" cx={relaySite.x} cy={relaySite.y} r={8 + relay * 20} opacity={relay * .9} />
    <circle className="mp-map-response" cx={thalamusSite.x} cy={thalamusSite.y} r={8 + thalamus * 20} opacity={thalamus * .9} />
  </g>
}

export function RecoveryPathway({ time, frames, times }: {
  time: number
  frames: readonly PainPathwayFrame[]
  times: PathwayTimes
}) {
  return <g className="mp-map-overlay mp-recovery-path" aria-hidden="true">
    <PathwayNerves time={time} frames={frames} times={times} />
    {recoverySites.map(site => <g key={site.id} className="mp-recovery-site">
      <path className="mp-map-leader" d={site.leader} />
      <circle className="mp-map-halo" cx={site.x} cy={site.y} r="7" />
      <circle className="mp-map-node" cx={site.x} cy={site.y} r="3" />
      <g transform={`translate(${site.labelX} ${site.labelY})`}>
        <rect x={-site.width / 2} y="-19" width={site.width} height="38" rx="5" />
        <text textAnchor="middle" alignmentBaseline="central" dominantBaseline="central" textLength={site.width - 20}
          lengthAdjust="spacingAndGlyphs">{site.label}</text>
      </g>
    </g>)}
  </g>
}

export function PathwayHeadMap({ id, view, sample, time, frames, times, aura, zoom, onInspect, onEvidence }: {
  id: string
  view: Station | 'binding'
  sample: Sample
  time: number
  frames: readonly PainPathwayFrame[]
  times: PathwayTimes
  aura: boolean
  zoom: number | undefined
  onInspect: (view: Station | 'binding') => void
  onEvidence: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  const camera = zoom === undefined ? 0 : zoom * zoom * (3 - 2 * zoom)
  const width = bounds.width * (1 - .76 * camera)
  const height = bounds.height * (1 - .76 * camera)
  const x = (bounds.x + bounds.width / 2) * (1 - camera) + ending.x * camera - width / 2
  const y = (bounds.y + bounds.height / 2) * (1 - camera) + ending.y * camera - height / 2
  const focusing = zoom !== undefined

  return <div className="mp-head-map">
    <div className="mp-map-art" data-camera={focusing ? 'close-up' : 'head'}>
      <HeadCutaway id={id + '-map'} sample={sample} nerve={sample} cortexOnly projection={{
        viewBox: `${x} ${y} ${width} ${height}`,
        label: focusing ? 'Zooming into the meningeal nerve ending.' : mapLabel,
        overlay: <g className="mp-map-overlay" aria-hidden="true">
          {aura && !focusing && <path className="mp-map-possible" d={possibleLink} opacity={view === 'cortex' && sample.auraFront > 0 ? 1 : .62} />}
          <PathwayNerves time={time} frames={frames} times={times} active={view} />
          {!focusing ? sites.map(site => <g key={site.id} className="mp-map-site" data-active={view === site.id}>
            <path className="mp-map-leader" d={site.leader} />
            <circle cx={site.x} cy={site.y} r="11" className="mp-map-halo" />
            <circle cx={site.x} cy={site.y} r="4" className="mp-map-node" />
          </g>) : <g className="mp-map-target" transform={`translate(${ending.x} ${ending.y})`}>
            <circle r={18 - camera * 8} />
            <circle r="3" />
            <path d="M0-24v7m0 34v7M-24 0h7m34 0h7" />
          </g>}
        </g>,
      }} />
      {!focusing && sites.map((site, i) => <button key={site.id} type="button"
        className="mp-map-label" aria-pressed={view === site.id} onClick={() => onInspect(site.id)}
        style={{ left: (site.labelX - bounds.x) / bounds.width * 100 + '%', top: (site.labelY - bounds.y) / bounds.height * 100 + '%' }}>
        <span><b aria-hidden="true">{i + 1}</b> {site.name}</span>
      </button>)}
    </div>
    <div className="mp-map-key">
      {!focusing ? <>
        <span className="mp-map-pain-key"><i /> Pain signal</span>
        {aura && <a href={'#' + id + '-evidence'} onClick={onEvidence}><i /> Possible aura link</a>}
        {view === 'meninges' && <button type="button" className="mp-map-binding" onClick={() => onInspect('binding')}>
          <Icon name="zoom" size={15} /> Treatment site
        </button>}
      </> : <strong role="status">Meningeal nerve ending</strong>}
    </div>
  </div>
}
