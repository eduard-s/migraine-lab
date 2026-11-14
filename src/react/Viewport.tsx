import { Icon } from './icon.js'
import { useEffect, useRef, useState } from 'react'
import { isAuraActive, LEVELS, type BodyModel, type Factors, type HeadRegion, type Pathway, type Sample, type Scale } from '../core/index.js'
import type { createLabScene, Marker, SceneEffect } from './scene.js'

const icons = { body: 'body', head: 'head', cells: 'cells', receptor: 'receptor' } as const
const levelDescriptions: Record<Scale, string> = {
  body: 'Open the head to follow the sensory pathway.',
  head: 'Rotate to see how the structures sit inside the head.',
  cells: 'Released messengers travel to receptors on the receiving cell.',
  receptor: 'Rotate the structure to see how the messenger fits.',
}

interface Props {
  body: BodyModel
  scale: Scale
  region: HeadRegion
  pathway: Pathway
  sample: Sample
  settings: Factors
  input: number
  effect?: SceneEffect
  activeTreatment?: string
  onAura: () => void
  setBody: (body: BodyModel) => void
  setScale: (scale: Scale) => void
  setRegion: (region: HeadRegion) => void
  setPathway: (pathway: Pathway) => void
}

export function Viewport({ body, scale, region, pathway, sample, settings, input, effect, activeTreatment, onAura, setBody, setScale, setRegion, setPathway }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const scene = useRef<ReturnType<typeof createLabScene> | null>(null)
  const currentView = useRef({ scale, region, pathway, sample, settings, input, effect })
  const [loadedBody, setLoadedBody] = useState<BodyModel>()
  const [anatomyStatus, setAnatomyStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [brainStatus, setBrainStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [renderStatus, setRenderStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    const target = canvas.current
    if (!target) return
    let active = true
    function updateCameraState() {
      const root = stage.current
      const moving = scene.current?.isTransitioning() ?? false
      if (root && (root.dataset.camera === 'moving') !== moving) root.dataset.camera = moving ? 'moving' : 'settled'
    }
    function positionMarker(marker: Marker, x: number, y: number) {
      const root = stage.current
      const button = root?.querySelector<HTMLElement>('[data-marker="' + marker + '"]')
      if (!root || !button) return
      const width = root.clientWidth
      const height = root.clientHeight
      if (marker === 'receptor') y += width < 500 ? 70 : 76
      const padding = button.offsetWidth + 16
      const alignLeft = marker === 'head' || marker === 'nerve' ? x + padding > width : x > width * 0.57
      button.dataset.align = alignLeft ? 'left' : 'right'
      const min = alignLeft ? padding : 17
      const max = alignLeft ? width - 17 : width - padding
      button.style.left = Math.max(min, Math.min(max, x)) + 'px'
      button.style.top = Math.max(62, Math.min(height - 60, y)) + 'px'
    }
    import('./scene.js').then(({ createLabScene }) => {
      if (!active) return
      const instance = createLabScene(target, positionMarker, updateCameraState)
      scene.current = instance
      instance.update(currentView.current)
      setRenderStatus('ready')
    }).catch(() => {
      if (!active) return
      scene.current?.dispose()
      scene.current = null
      setRenderStatus('unavailable')
    })
    return () => {
      active = false
      scene.current?.dispose()
      scene.current = null
    }
  }, [])

  useEffect(() => {
    const instance = scene.current
    if (renderStatus !== 'ready' || !instance) return
    let active = true
    setAnatomyStatus('loading')
    import('./anatomy.js').then(({ loadAnatomy }) => loadAnatomy(body)).then(anatomy => {
      if (!active) return
      instance.setAnatomy(anatomy)
      setLoadedBody(body)
      setAnatomyStatus('ready')
    }).catch(() => {
      if (active) setAnatomyStatus('unavailable')
    })
    return () => { active = false }
  }, [body, renderStatus])

  const showBrain = scale === 'head'
  useEffect(() => {
    const instance = scene.current
    if (!showBrain || renderStatus !== 'ready' || brainStatus !== 'loading' || !instance) return
    let active = true
    import('./anatomy.js').then(({ loadBrain }) => loadBrain()).then(brain => {
      if (!active) return
      instance.setBrain(brain)
      setBrainStatus('ready')
    }).catch(() => {
      if (active) setBrainStatus('unavailable')
    })
    return () => { active = false }
  }, [showBrain, renderStatus, brainStatus])

  useEffect(() => {
    currentView.current = { scale, region, pathway, sample, settings, input, effect }
    scene.current?.update(currentView.current)
  }, [scale, region, pathway, sample, settings, input, effect])

  useEffect(() => {
    if (renderStatus === 'ready') scene.current?.update(currentView.current)
  }, [renderStatus, anatomyStatus, brainStatus])

  const needsAnatomy = scale === 'body' || scale === 'head'
  const showAtlas = showBrain && brainStatus === 'ready'
  const anatomyReady = anatomyStatus === 'ready' && loadedBody === body
  const inStructure = scale === 'receptor'
  const record = pathway === 'cgrp' ? '6E3Y' : '6M1I'
  const structure = pathway === 'cgrp' ? 'Human CGRP receptor with CGRP' : 'Human PAC1 receptor with PACAP38'
  const wave = Math.min(1, sample.auraFront)
  const wake = Math.min(1, sample.auraWake)
  const waveInView = isAuraActive(sample)
  const targetLabel = effect?.target === 'release' ? 'Nerve ending targeted' : effect?.target === 'messenger' ? 'Antibody binds messenger' : 'Receptors blocked'
  const interventionActive = effect && sample.engagement >= 0.055

  return (
    <section className="specimen" aria-label="3D anatomy explorer">
      <div className="specimen-stage" ref={stage} data-scale={scale} data-body={anatomyReady ? loadedBody : undefined} data-atlas={showAtlas ? region : undefined}>
        <canvas ref={canvas} className="specimen-canvas" hidden={renderStatus === 'unavailable'} aria-hidden="true" />
        <nav className="scale-nav" aria-label="Anatomical scale">
          {LEVELS.map(({ id, label }) => (
              <button key={id} type="button" aria-pressed={scale === id} onClick={() => setScale(id)}>
                <Icon name={icons[id]} /> <span>{label}</span>
              </button>
          ))}
        </nav>
        {scale === 'body' && (
          <div className="figure-select subview" aria-label="3D body">
            <button type="button" aria-pressed={body === 'female'} onClick={() => setBody('female')}>Female</button>
            <button type="button" aria-pressed={body === 'male'} onClick={() => setBody('male')}>Male</button>
          </div>
        )}
        {(renderStatus === 'loading' || (renderStatus === 'ready' && needsAnatomy && !anatomyReady && anatomyStatus !== 'unavailable')) && <p className="scene-fallback" role="status">Loading 3D anatomy</p>}
        {renderStatus === 'ready' && needsAnatomy && anatomyStatus === 'unavailable' && (
          <p className="scene-fallback" role="status">The body model could not load. You can still explore the cell and receptor views.</p>
        )}
        {renderStatus === 'unavailable' && (
          <p className="scene-fallback" role="status">The 3D view couldn’t load. The case, controls, and treatment comparisons are available below.</p>
        )}
        {renderStatus === 'ready' && showBrain && brainStatus === 'loading' && (
          <p className="atlas-status" role="status">Loading brain atlas…</p>
        )}
        {renderStatus === 'ready' && showBrain && brainStatus === 'unavailable' && (
          <p className="atlas-status" role="status">Brain atlas unavailable</p>
        )}
        {renderStatus === 'ready' && (
          <>
            {scale === 'body' && anatomyReady && <Hotspot marker="head" label="Explore head" action={() => setScale('head')} />}
            {scale === 'head' && region === 'nerve' && <Hotspot marker="nerve" label="Explore nerve ending" action={() => setScale('cells')} />}
            {scale === 'cells' && <Hotspot marker="receptor" label="Inspect receptor" action={() => setScale('receptor')} />}
            {scale === 'cells' && <AnatomyLabel marker="terminal">Sensory nerve ending</AnatomyLabel>}
            {scale === 'cells' && <AnatomyLabel marker="nucleus">Nucleus</AnatomyLabel>}
            {scale === 'cells' && <AnatomyLabel marker="membrane">Cell membrane</AnatomyLabel>}
            {scale === 'head' && region === 'nerve' && <AnatomyLabel marker="ganglion">Trigeminal ganglion</AnatomyLabel>}
            {showAtlas && region === 'nerve' && <AnatomyLabel marker="pons">Pons</AnatomyLabel>}
            {showAtlas && region === 'cortex' && <AnatomyLabel marker="occipital">Occipital cortex</AnatomyLabel>}
            {showAtlas && region === 'cortex' && <AnatomyLabel marker="cerebellum">Cerebellum</AnatomyLabel>}
            <div className="camera-buttons" aria-label="Camera controls">
              <button type="button" className="icon-button on-scene" aria-label="Zoom in" title="Zoom in" onClick={() => scene.current?.zoom(0.8)}><Icon name="plus" /></button>
              <button type="button" className="icon-button on-scene" aria-label="Zoom out" title="Zoom out" onClick={() => scene.current?.zoom(1.25)}><Icon name="minus" /></button>
              <button type="button" className="icon-button on-scene" aria-label="Rotate 3D view" title="Rotate view" onClick={() => scene.current?.rotate()}>
                <Icon name="rotate" size={17} />
              </button>
              <button type="button" className="icon-button on-scene" aria-label="Reset 3D view" title="Reset view" onClick={() => scene.current?.reset()}>
                <Icon name="reset" size={17} />
              </button>
            </div>
          </>
        )}
        {waveInView && scale === 'body' && (
          <button className="aura-in-scene" type="button" onClick={onAura}>
            <Icon name="eye" /> View active aura
          </button>
        )}
        {scale === 'head' && region === 'cortex' && (
          <div className="visual-field" aria-label="Visual field affected by the modeled aura">
            <div className="visual-field-map" aria-hidden="true">
              <span className="field-center" />
              {waveInView && <span className="field-wave" style={{ left: 23 + wave * 66 + '%', width: 12 + Math.max(0, wave - wake) * 32 + '%' }} />}
            </div>
            <span>{waveInView ? 'Aura spreading' : 'Visual field'}</span>
          </div>
        )}
        <div className="specimen-label">
          {inStructure ? (
            <><span className="specimen-label-title">{structure}</span><a href={'https://www.rcsb.org/structure/' + record} target="_blank" rel="noreferrer">PDB {record}</a></>
          ) : (
            <span>{scale === 'body' ? (body === 'female' ? 'Female anatomy' : 'Male anatomy') : scale === 'head' ? (region === 'nerve' ? 'Trigeminal nerve' : 'Visual cortex') : 'Nerve ending and receiving cell'}</span>
          )}
        </div>
      </div>
      <div className="specimen-caption">
        <p>{levelDescriptions[scale]}</p>
        {scale === 'head' && (
          <div className="subview" aria-label="Head region">
            <button type="button" aria-pressed={region === 'nerve'} onClick={() => setRegion('nerve')}><Icon name="crosshair" size={15} /> Trigeminal nerve</button>
            <button type="button" aria-pressed={region === 'cortex'} onClick={() => setRegion('cortex')}><Icon name="head" size={15} /> Visual cortex</button>
          </div>
        )}
        {scale === 'head' && region === 'nerve' && <div className="nerve-key">
          <span className="key-v1">V1 · Eye and forehead</span><span className="key-v2">V2 · Cheek</span><span className="key-v3">V3 · Jaw</span>
        </div>}
        {scale === 'cells' && <div className="messenger-key"><span className="key-cgrp">CGRP</span><span className="key-pacap">PACAP</span></div>}
        {scale === 'cells' && activeTreatment && (
          <div className="cell-treatment-state" data-engaged={Boolean(interventionActive)}>
            {effect ? activeTreatment + (interventionActive ? ' · ' + targetLabel : ' · Target selected') : 'Untreated view'}
          </div>
        )}
        {inStructure && (
          <div className="messenger-key"><span className={pathway === 'cgrp' ? 'key-cgrp' : 'key-pacap'}>Bound {pathway === 'cgrp' ? 'CGRP' : 'PACAP'}</span><span className="key-membrane">Cell membrane</span></div>
        )}
        {inStructure && (
          <div className="subview" aria-label="Receptor structure">
            <button type="button" aria-pressed={pathway === 'cgrp'} onClick={() => setPathway('cgrp')}>CGRP receptor</button>
            <button type="button" aria-pressed={pathway === 'pacap'} onClick={() => setPathway('pacap')}>PAC1 receptor</button>
          </div>
        )}
      </div>
    </section>
  )
}

function Hotspot({ marker, label, action }: { marker: Marker; label: string; action: () => void }) {
  return (
    <button className="hotspot" type="button" data-marker={marker} onClick={action}>
      <span className="hotspot-pin"><Icon name="crosshair" size={17} /></span>
      <span className="hotspot-label">{label} <Icon name="arrow" size={14} /></span>
    </button>
  )
}

function AnatomyLabel({ marker, children }: { marker: Marker; children: string }) {
  return <span className="anatomy-label" data-marker={marker}>{children}</span>
}
