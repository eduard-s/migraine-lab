import type { ReactNode } from 'react'
import { isAuraActive, type Sample } from '../core/index.js'
import { nerveStrength } from './workbench-episode.js'

export const anatomyViews = {
  brain: { name: 'Brain', label: 'Visual cortex', x: 132, y: 193, line: 'M-125 71H48L132 193' },
  nerve: { name: 'Trigeminal nerve', label: 'Trigeminal ganglion', x: 270, y: 265, line: 'M-125 248H148L187 265H270' },
  vessel: { name: 'Blood vessel', label: 'Meningeal artery', x: 240, y: 180, line: 'M-125 463H77V322L240 180' },
  vision: { name: 'Her vision', label: 'Visual field', x: 422, y: 218, line: 'M665 68H495V157L422 218' },
  receptor: { name: 'CGRP receptor', label: 'Receptor near the nerve ending', x: 320, y: 138, line: 'M665 252H481L362 138H320' },
  symptoms: { name: 'Symptoms', label: 'Head pain', x: 378, y: 288, line: 'M665 468H498V374L378 288' },
} as const

export type AnatomyView = keyof typeof anatomyViews

const cortex = 'M88 222C92 171 113 134 141 110C171 87 205 77 247 74C292 69 327 79 355 97C383 115 399 145 401 174C407 193 392 205 374 213C351 225 338 234 325 245C298 265 274 253 241 247C211 241 189 241 169 245C145 246 131 265 108 254C96 245 90 231 88 222Z'
const artery = 'M253 269C245 249 241 213 240 180C239 157 222 135 216 122C209 108 209 97 210 87'
const arteryBranches = [
  'M243 215C258 199 262 177 283 162C298 150 311 151 320 138C334 119 336 106 337 96',
  'M240 180C225 175 215 169 207 157C195 136 177 129 157 124',
  'M283 162C302 166 321 165 337 154C355 141 365 139 375 139',
  'M217 124C228 112 241 101 257 94',
]
const nerveTrunk = 'M320 138C302 151 297 167 299 188C301 217 289 249 270 265C251 273 233 262 209 274'
const nerveBranches = [
  'M270 265C294 241 327 231 353 220C376 210 400 201 421 199C432 195 438 185 442 175',
  'M270 265C302 260 328 269 359 277C380 281 397 290 412 303C422 312 433 312 452 310',
  'M270 265C278 287 293 303 310 320C334 345 361 362 393 369C413 374 428 371 447 369',
]

export function HeadCutaway({ id, sample, nerve, focused, inspect, bindingOpen = false, cortexOnly = false, projection }: {
  id: string
  sample: Sample
  nerve: Sample
  focused?: AnatomyView
  inspect?: (view: AnatomyView, opener: HTMLButtonElement) => void
  bindingOpen?: boolean
  cortexOnly?: boolean
  projection?: { viewBox: string; label: string; overlay: ReactNode }
}) {
  const signal = nerveStrength(nerve)
  const vessel = Math.min(1, sample.cgrpSignal * 1.8)
  const aura = isAuraActive(sample)
  const front = 98 + Math.min(1, sample.auraFront) * 302
  const wake = 94 + Math.min(1, sample.auraWake) * 304
  const pain = sample.headache
  const views = Object.keys(anatomyViews) as AnatomyView[]

  return <figure className="mw-cutaway" aria-label={inspect ? 'Interactive head cutaway' : undefined}>
    <svg className="mw-head" viewBox={projection?.viewBox ?? (inspect ? '0 0 540 560' : '34 0 466 536')}
      role={inspect ? undefined : 'img'}
      aria-label={projection?.label ?? (inspect ? 'Side cutaway of a woman’s head with six inspection points' :
        cortexOnly ? 'Cortical wave on the head cutaway' : 'Temple glow follows the modeled head pain')}>
      <defs>
        <clipPath id={id + '-brain-window'}><path d={cortex} /></clipPath>
        <radialGradient id={id + '-temple-pain'}>
          <stop stopColor={inspect ? '#f59662' : '#ffad62'} stopOpacity=".86" />
          <stop offset=".45" stopColor={inspect ? '#f59662' : '#f26335'} stopOpacity=".38" />
          <stop offset="1" stopColor="#f59662" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id + '-wave-band'}>
          <stop stopColor={cortexOnly ? '#e27829' : '#a89eea'} stopOpacity="0" />
          <stop offset=".64" stopColor={cortexOnly ? '#f48127' : '#b8a7ff'} stopOpacity={cortexOnly ? '.9' : '.58'} />
          <stop offset="1" stopColor={cortexOnly ? '#ffdaa1' : '#ddd3ff'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g aria-hidden="true">
        <path d="M270 12V534M26 270H514M65 72H475M65 464H475" className="mw-head-grid" />
        <ellipse cx="271" cy="268" rx="227" ry="247" className="mw-head-orbit" />
        <foreignObject x="41" y="9" width="450" height="521" pointerEvents="none">
          <div className="mw-cutaway-art" />
        </foreignObject>

        {inspect && <ellipse cx="374" cy="279" rx={55 + pain * 44} ry={63 + pain * 37}
          fill={'url(#' + id + '-temple-pain)'} opacity={pain * 0.94} />}
        {(inspect || cortexOnly) && aura && <g clipPath={'url(#' + id + '-brain-window)'} className="mw-cortical-wave">
          <path d={`M${wake - 16} 68H${front}V271H${wake - 16}Z`} fill="#29223f" opacity=".35" />
          <rect x={front - 47} y="68" width="64" height="203" fill={'url(#' + id + '-wave-band)'} />
          <path d={`M${front - 4} 70q-20 33 -5 66t-4 71t-1 61`} fill="none"
            stroke={cortexOnly ? '#ffe2af' : '#e2d9ff'} strokeWidth="2.8" opacity=".85" />
        </g>}
        {!cortexOnly && !projection && <>
        <g className="mw-artery" strokeWidth={1.6 + vessel * 2.7} opacity={(0.43 + vessel * 0.55) * (inspect ? 1 : 0.48)}>
          <path d={artery} strokeWidth={2.3 + vessel * 3.9} />
          {arteryBranches.map(path => <path key={path} d={path} />)}
          <path d={artery} className="mw-artery-flow" pathLength="100" strokeWidth={1 + vessel * 1.25}
            strokeDasharray="2 9" strokeDashoffset={sample.time * 5} />
        </g>
        <g className="mw-nerve-base" opacity={(0.40 + signal * 0.55) * (inspect ? 1 : 0.52)}>
          <path d={nerveTrunk} strokeWidth={2.4 + signal * 3.1} />
          {nerveBranches.map(path => <path key={path} d={path} strokeWidth={1.5 + signal * 1.9} />)}
        </g>
        <g className="mw-nerve-pulse" opacity={Math.sqrt(signal) * (inspect ? 1 : 0.38)}>
          <path d={nerveTrunk} pathLength="100" strokeDasharray={`${2 + signal * 11} ${26 - signal * 13}`}
            strokeDashoffset={-sample.time * 9} strokeWidth={2 + signal * 6} />
          {nerveBranches.map(path => <path key={path} d={path} pathLength="100"
            strokeDasharray={`${2 + signal * 6} 27`} strokeDashoffset={sample.time * 7} strokeWidth={1.1 + signal * 3.8} />)}
        </g>
        </>}
        {!inspect && !cortexOnly && <g className="mw-recovery-glow" opacity={Math.min(1, pain * 1.8)}>
          <ellipse cx="354" cy="187" rx={50 + pain * 80} ry={53 + pain * 77} fill={'url(#' + id + '-temple-pain)'} />
          <ellipse cx="354" cy="187" rx={20 + pain * 28} ry={23 + pain * 27} fill="none" stroke="#ffe4b4" strokeWidth="2.3" opacity=".82" />
          <ellipse cx="354" cy="187" rx={30 + pain * 45} ry={34 + pain * 44} fill="none" stroke="#ff9465" strokeWidth="1.75" opacity=".62" />
        </g>}
        {inspect && views.map(view => <path key={view} d={anatomyViews[view].line} className="mw-head-guide"
          data-view={view} data-focused={focused === view} />)}
      </g>
      {projection?.overlay}
      {inspect && views.map(view => {
        const { x, y, name, label } = anatomyViews[view]
        return <foreignObject key={view} x={x - 42} y={y - 42} width="84" height="84">
          <button type="button" className="mw-anatomy-point" data-view={view} aria-pressed={focused === view}
            aria-label={'Inspect ' + name} aria-controls={id + (view === 'receptor' ? '-binding' : '-' + view)}
            aria-expanded={view === 'receptor' ? bindingOpen : undefined}
            title={view === 'receptor' ? 'Zoom into the CGRP binding site' : label}
            onClick={event => inspect(view, event.currentTarget)}><span /></button>
        </foreignObject>
      })}
    </svg>
    {inspect && <figcaption>Select a marker to inspect a view <a className="mw-controls-jump" href={'#' + id + '-settings'}>Go to controls</a></figcaption>}
  </figure>
}
