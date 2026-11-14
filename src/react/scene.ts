import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Factors, HeadRegion, Pathway, Sample, Scale } from '../core/index.js'
import type { loadAnatomy } from './anatomy.js'
import { makeHead, headLabels } from './head-scene.js'
import { makeCells, type SceneEffect } from './cell-scene.js'
import { makeStructure } from './receptor-scene.js'
import { disposeMeshes, finish, mesh, oval, v, type Point } from './scene-geometry.js'

export type { SceneEffect } from './cell-scene.js'
export type Marker = 'head' | 'nerve' | 'receptor' | 'ganglion' | 'pons' | 'occipital' | 'cerebellum' | 'terminal' | 'membrane' | 'nucleus'

interface SceneState {
  scale: Scale
  region: HeadRegion
  pathway: Pathway
  sample: Sample
  settings: Factors
  input: number
  effect?: SceneEffect
}

function makeBody(sphere: T.BufferGeometry) {
  const group = new T.Group()

  const stand = mesh(group, new T.CylinderGeometry(1.19, 1.24, 0.085, 80), finish('#718273', { roughness: 0.94 }))
  stand.position.y = -2.956
  const floor = mesh(group, new T.RingGeometry(1.31, 1.33, 72), new T.MeshBasicMaterial({
    color: '#839686', transparent: true, opacity: 0.5, side: T.DoubleSide,
  }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -3.001

  const highlighted = finish('#dfb367', { emissive: '#b07527', emissiveIntensity: 0.17 })
  const temple: Point = [0.238, 2.686, 0.225]
  const pin = oval(group, sphere, highlighted, temple, [0.037, 0.037, 0.037])
  const rings = new T.Group()
  rings.position.set(...temple)
  rings.rotation.y = 0.36
  group.add(rings)
  const halos = [0.101, 0.172, 0.245].map((radius, index) => {
    const material = new T.MeshBasicMaterial({ color: '#ab4c3e', transparent: true, opacity: 0.8, depthWrite: false, side: T.DoubleSide })
    return mesh(rings, new T.RingGeometry(radius - 0.019 + index * 0.003, radius, 56), material)
  })
  const abdomen = oval(group, new T.RingGeometry(0.17, 0.187, 56), new T.MeshBasicMaterial({
    color: '#a26f45', transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide,
  }), [0, 0.73, 0.37], [1.2, 1, 1])
  const eyeSensitivity = oval(group, new T.RingGeometry(0.077, 0.083, 48), new T.MeshBasicMaterial({
    color: '#b38838', transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide,
  }), [-0.075, 2.63, 0.356], [1, 0.72, 1])
  return {
    group,
    update(sample: Sample, input: number) {
      const pain = sample.headache
      pin.visible = pain > 0.025 || input > 0.015
      highlighted.emissiveIntensity = 0.2 + pain * 0.9 + input * 0.5
      halos.forEach((ring, index) => {
        ring.visible = pain > [0.03, 0.17, 0.33][index] || (index === 0 && input > 0.015)
        ring.material.opacity = Math.min(0.95, 0.21 + pain * 1.25 + input * 0.32 - index * 0.08)
        ring.material.color.setHex(pain > 0.035 ? 0xae4c3b : 0xae842f)
        ring.scale.setScalar(0.9 + 0.82 * pain + 0.11 * Math.sin(sample.time * 0.81 - index * 0.76))
      })
      abdomen.visible = sample.nausea > 0.07
      abdomen.material.opacity = Math.min(0.7, sample.nausea * 1.8)
      eyeSensitivity.visible = sample.lightSensitivity > 0.08
      eyeSensitivity.material.opacity = Math.min(0.85, sample.lightSensitivity * 1.8)
    },
  }
}

const markerPositions: Record<Marker, Point> = {
  ...headLabels,
  head: [0.58, 2.68, 0.22],
  nerve: [0.41, 2.31, 0.06],
  receptor: [1.51, 0.55, 0.24],
  terminal: [-2.28, 1.00, 0.36],
  membrane: [2.55, 1.39, 0.20],
  nucleus: [2.60, 0.20, 0.72],
}

const poses: Record<Scale | 'cortex', { camera: Point; target: Point }> = {
  body: { camera: [2.55, 1.27, 12.0], target: [0, 0.38, 0] },
  head: { camera: [0.98, 2.72, 1.69], target: [0, 2.57, 0.025] },
  cortex: { camera: [0.47, 2.78, -1.65], target: [0, 2.62, -0.10] },
  cells: { camera: [0.28, 1.30, 11.8], target: [0.29, 0.07, 0] },
  receptor: { camera: [1.68, 0.63, 12.4], target: [0, 0.34, 0] },
}

export function createLabScene(
  canvas: HTMLCanvasElement,
  projectMarker: (marker: Marker, x: number, y: number) => void,
  paint: () => void,
) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.02
  const world = new T.Scene()
  const camera = new T.PerspectiveCamera(36, 1, 0.05, 85)
  camera.aspect = Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight)
  const controls = new OrbitControls(camera, canvas)
  controls.enablePan = false
  controls.rotateSpeed = 0.72
  controls.enableZoom = false
  controls.maxPolarAngle = Math.PI * 0.85
  controls.minPolarAngle = Math.PI * 0.13
  canvas.style.touchAction = 'pan-y'
  const main = new T.DirectionalLight('#fff2de', 2.75)
  main.position.set(4, 7, 5)
  const rim = new T.DirectionalLight('#e4ebda', 1.85)
  rim.position.set(-5, 3, -5)
  const fill = new T.DirectionalLight('#adbd9d', 0.91)
  fill.position.set(-6, 0, 5)
  world.add(new T.HemisphereLight('#f1f4e9', '#60554e', 1.48), main, rim, fill)
  const sphere = new T.SphereGeometry(1, 38, 26)
  const body = makeBody(sphere)
  const head = makeHead(sphere)
  const cells = makeCells(sphere)
  const structures = {
    cgrp: makeStructure('cgrp'),
    pacap: makeStructure('pacap'),
  }
  world.add(body.group, head.group, cells.group, structures.cgrp, structures.pacap)

  let state: SceneState | undefined
  let figure: T.Object3D | undefined
  let flight = 0
  const projected = new T.Vector3()
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  function draw() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height || !state) return
    renderer.render(world, camera)
    paint()
    for (const [marker, point] of Object.entries(markerPositions)) {
      projected.set(...point)
      const receivingX = 0.96 + state.settings.distance * 0.031
      if (marker === 'receptor') projected.x = receivingX - 1.0
      if (marker === 'membrane') projected.x = receivingX + 0.48
      if (marker === 'nucleus') projected.x = receivingX + 0.25
      projected.project(camera)
      projectMarker(marker as Marker, (projected.x + 1) * width / 2, (1 - projected.y) * height / 2)
    }
  }
  controls.addEventListener('change', draw)
  controls.addEventListener('start', stopFlight)
  const resize = new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = canvas
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    draw()
  })
  resize.observe(canvas)

  function stopFlight() {
    cancelAnimationFrame(flight)
    flight = 0
  }

  function setPose(animate: boolean) {
    if (!state) return
    const pose = poses[state.scale === 'head' && state.region === 'cortex' ? 'cortex' : state.scale]
    const target = v(pose.target)
    const position = v(pose.camera)
    if (state.scale === 'cells' || state.scale === 'head') {
      const offset = position.clone().sub(target)
      const width = 2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * offset.length() * camera.aspect
      const needed = state.scale === 'cells' ? 10.45 : 1.01
      if (width < needed) position.copy(target).addScaledVector(offset, needed / width)
    }
    const distance = target.distanceTo(position)
    const fromPosition = camera.position.clone()
    const fromTarget = controls.target.clone()
    stopFlight()
    const set = (fraction: number) => {
      camera.position.lerpVectors(fromPosition, position, fraction)
      controls.target.lerpVectors(fromTarget, target, fraction)
      controls.update()
      draw()
    }
    if (!animate || reducedMotion.matches) {
      controls.minDistance = distance * 0.52
      controls.maxDistance = distance * 2.05
      set(1)
      return
    }
    controls.minDistance = 0.24
    controls.maxDistance = 27
    const start = performance.now()
    function step(now: number) {
      const progress = Math.min(1, (now - start) / 430)
      if (progress < 1) flight = requestAnimationFrame(step)
      else {
        flight = 0
        controls.minDistance = distance * 0.52
        controls.maxDistance = distance * 2.05
      }
      set(1 - (1 - progress) ** 4)
    }
    flight = requestAnimationFrame(step)
    paint()
  }

  return {
    setBrain(brain: T.Group) {
      head.setBrain(brain)
      draw()
    },
    setAnatomy(anatomy: Awaited<ReturnType<typeof loadAnatomy>>) {
      if (figure) {
        figure.removeFromParent()
        disposeMeshes(figure)
      }
      figure = anatomy.figure
      body.group.add(anatomy.figure)
      head.setCutaway(anatomy.cutaway)
      draw()
    },
    update(next: SceneState) {
      const previous = state
      state = next
      body.group.visible = next.scale === 'body'
      head.group.visible = next.scale === 'head'
      cells.group.visible = next.scale === 'cells'
      for (const [pathway, structure] of Object.entries(structures)) {
        structure.visible = next.scale === 'receptor' && next.pathway === pathway
      }
      if (next.scale === 'body') body.update(next.sample, next.input)
      if (next.scale === 'head') head.update(next.sample, next.region, next.input)
      if (next.scale === 'cells') cells.update(next.sample, next.settings, next.effect)
      if (!previous || previous.scale !== next.scale || (next.scale === 'head' && previous.region !== next.region)) {
        const anatomicalZoom = previous && ['body', 'head'].includes(previous.scale) && ['body', 'head'].includes(next.scale)
        setPose(Boolean(anatomicalZoom))
      } else {
        draw()
      }
    },
    reset() { setPose(false) },
    isTransitioning() { return flight !== 0 },
    zoom(factor: number) {
      stopFlight()
      const offset = camera.position.clone().sub(controls.target)
      offset.setLength(T.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance))
      camera.position.copy(controls.target).add(offset)
      controls.update()
      draw()
    },
    rotate() {
      stopFlight()
      const point = camera.position.clone().sub(controls.target)
      point.applyAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 5)
      camera.position.copy(controls.target).add(point)
      controls.update()
      draw()
    },
    dispose() {
      stopFlight()
      resize.disconnect()
      controls.dispose()
      head.dispose()
      disposeMeshes(world)
      renderer.dispose()
    },
  }
}
