import * as T from 'three'
import { isAuraActive, type HeadRegion, type Sample } from '../core/index.js'
import { curve, finish, line, mesh, oval, tube, type Point } from './scene-geometry.js'

export const headLabels: Record<'pons' | 'ganglion' | 'occipital' | 'cerebellum', Point> = {
  pons: [0.068, 2.536, -0.010],
  ganglion: [0.183, 2.484, 0.130],
  occipital: [0.108, 2.627, -0.375],
  cerebellum: [0.12, 2.451, -0.267],
}

const nerveColors = { root: '#917d49', v1: '#bd872a', v2: '#a65d46', v3: '#547e70' }

// Schematic path along the inner cranial surface, starting at the ganglion.
function meningealPath(side: number) {
  const points: Point[] = [[0.182, 2.485, 0.128], [0.233, 2.498, 0.114], [0.284, 2.599, 0.105],
    [0.291, 2.711, 0.026], [0.238, 2.823, -0.070], [0.150, 2.886, -0.146]]
  return curve(points.map(([x, y, z]) => [x * side, y, z]))
}

export function makeHead(sphere: T.BufferGeometry) {
  const group = new T.Group()
  const pathway = new T.Group()
  group.add(pathway)

  const skin = finish('#bd977c', { transparent: true, opacity: 0.23, depthWrite: false })
  const cerebrum = finish('#b98376', { roughness: 0.77, transparent: true, depthWrite: false })
  const occipital = finish('#c49687', { roughness: 0.72, transparent: true, depthWrite: false })
  const cerebellum = finish('#a36e61', { roughness: 0.76, transparent: true, depthWrite: false })
  const stem = finish('#a7836e', { roughness: 0.72, transparent: true, depthWrite: false })
  const colors = {
    root: finish(nerveColors.root),
    v1: finish(nerveColors.v1, { emissive: '#cc7221', emissiveIntensity: 0.1 }),
    v2: finish(nerveColors.v2),
    v3: finish(nerveColors.v3),
  }
  let outer: T.Mesh | undefined
  let brain: T.Group | undefined

  const wave = {
    front: { value: 0 },
    wake: { value: 0 },
    visible: { value: 0 },
    warm: { value: new T.Color('#f0bb57') },
    shadow: { value: new T.Color('#876349') },
  }
  occipital.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      auraFront: wave.front, auraWake: wave.wake, auraVisible: wave.visible, auraWarm: wave.warm, auraShadow: wave.shadow,
    })
    shader.vertexShader = 'varying vec3 atlasPoint;\n' + shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\natlasPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = `
      varying vec3 atlasPoint;
      uniform float auraFront, auraWake, auraVisible;
      uniform vec3 auraWarm, auraShadow;
    ` + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float d = length((atlasPoint - vec3(0.089, 2.586, -0.396)) * vec3(2.8, 3.2, 3.0));
      float oneHemisphere = smoothstep(0.0, 0.016, atlasPoint.x);
      float band = smoothstep(auraWake - 0.025, auraWake + 0.025, d) * (1.0 - smoothstep(auraFront - 0.017, auraFront + 0.035, d));
      float edge = exp(-abs(d - auraFront) * 27.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, auraShadow, band * oneHemisphere * auraVisible * 0.73);
      diffuseColor.rgb = mix(diffuseColor.rgb, auraWarm, edge * oneHemisphere * auraVisible * 0.92);
    `)
  }

  const trajectories: T.CatmullRomCurve3[] = []
  for (const side of [-1, 1]) {
    const p = (x: number, y: number, z: number): Point => [side * x, y, z]
    const ganglion = p(0.182, 2.485, 0.128)
    const root = curve([p(0.069, 2.525, -0.025), p(0.108, 2.507, 0.025), p(0.145, 2.483, 0.082), ganglion])
    tube(pathway, root, 0.009, colors.root)
    const junction = oval(pathway, sphere, colors.root, ganglion, [0.037, 0.014, 0.042])
    junction.rotation.y = side * 0.38
    junction.rotation.z = side * 0.21

    const orbit = p(0.142, 2.604, 0.267)
    const v1 = [ganglion, p(0.151, 2.528, 0.170), p(0.128, 2.567, 0.225), orbit, p(0.164, 2.643, 0.309), p(0.177, 2.723, 0.335), p(0.155, 2.772, 0.310)]
    const cheek = p(0.215, 2.486, 0.291)
    const v2 = [ganglion, p(0.194, 2.501, 0.184), p(0.191, 2.482, 0.228), cheek, p(0.196, 2.477, 0.377), p(0.153, 2.443, 0.413)]
    const jaw = p(0.268, 2.290, 0.185)
    const v3 = [ganglion, p(0.222, 2.444, 0.124), p(0.252, 2.390, 0.139), jaw, p(0.242, 2.232, 0.252), p(0.167, 2.218, 0.338), p(0.092, 2.222, 0.394)]
    for (const [id, points] of [['v1', v1], ['v2', v2], ['v3', v3]] as const) {
      line(pathway, points, 0.0075, colors[id])
    }
    line(pathway, [orbit, p(0.097, 2.618, 0.294), p(0.061, 2.559, 0.386)], 0.0048, colors.v1)
    line(pathway, [v1[4], p(0.222, 2.659, 0.296), p(0.249, 2.694, 0.239)], 0.0045, colors.v1)
    line(pathway, [cheek, p(0.215, 2.443, 0.326), p(0.174, 2.424, 0.381)], 0.0048, colors.v2)
    line(pathway, [v3[2], p(0.276, 2.367, 0.159), p(0.314, 2.440, 0.106)], 0.0049, colors.v3)
    line(pathway, [jaw, p(0.233, 2.286, 0.266), p(0.185, 2.260, 0.343)], 0.0045, colors.v3)
    const dura = meningealPath(side)
    tube(pathway, dura, 0.0058, colors.v1, 60)
    line(pathway, [p(0.288, 2.66, 0.072), p(0.311, 2.721, -0.065), p(0.275, 2.778, -0.154)], 0.0038, colors.v1)
    trajectories.push(dura)
  }

  const signal = new T.MeshBasicMaterial({ color: '#ffd084' })
  const pulses = trajectories.flatMap(path => Array.from({ length: 4 }, (_, index) => ({
    path, index, bead: oval(pathway, sphere, signal, [0, 0, 0], [0.009, 0.009, 0.009]),
  })))

  return {
    group,
    setBrain(next: T.Group) {
      brain = next
      next.traverse(object => {
        if (!(object instanceof T.Mesh)) return
        object.material = object.name.startsWith('OccipitalCortex') ? occipital
          : object.name.startsWith('Cerebellum') ? cerebellum
          : object.name.startsWith('Brainstem') ? stem : cerebrum
        object.renderOrder = 1
      })
      group.add(next)
    },
    setCutaway(cutaway: T.Mesh) {
      if (outer) {
        outer.removeFromParent()
        outer.geometry.dispose()
      }
      cutaway.material = skin
      cutaway.renderOrder = 2
      outer = cutaway
      group.add(cutaway)
    },
    update(sample: Sample, region: HeadRegion, input: number) {
      const cortex = region === 'cortex'
      if (brain) brain.visible = true
      pathway.visible = !cortex
      skin.opacity = cortex ? 0.095 : 0.21
      cerebrum.opacity = cortex ? 1 : 0.28
      occipital.opacity = cortex ? 1 : 0.28
      cerebellum.opacity = cortex ? 1 : 0.48
      stem.opacity = cortex ? 1 : 0.86
      for (const material of [cerebrum, occipital, cerebellum, stem]) material.depthWrite = cortex
      const activity = Math.max(input * 0.35, Math.min(1, sample.freeCgrp * 1.8 + sample.freePacap * 0.45))
      colors.v1.emissiveIntensity = 0.07 + activity * 0.65
      for (const { path, index, bead } of pulses) {
        bead.visible = !cortex && (index + 0.3) / 4 < activity
        if (bead.visible) path.getPointAt(1 - ((sample.time * 0.12 + index * 0.24) % 1), bead.position)
      }
      wave.front.value = Math.min(1.05, sample.auraFront)
      wave.wake.value = sample.auraWake
      wave.visible.value = cortex && isAuraActive(sample) ? 1 : 0
    },
    dispose() {
      for (const material of [skin, cerebrum, occipital, cerebellum, stem]) material.dispose()
    },
  }
}
