import * as T from 'three'
import type { Factors, Pathway, Sample, Target } from '../core/index.js'
import { curve, finish, line, mesh, oval, tube, v, type Point } from './scene-geometry.js'

export type SceneEffect = { target: Target; pathway: Pathway }
export const cellColors = { cgrp: '#db901f', pacap: '#448e7d', treatment: '#b74f43' }

const RX = 1.36
const RY = 1.42
const RZ = 1.13
const membraneCenterY = -0.05
const sectionStart = 0.82
const sectionEnd = Math.PI * 2 - sectionStart

function ellipsoidSurface() {
  const points: number[] = []
  const triangles: number[] = []
  const rings = 38
  const sectors = 72
  for (let row = 0; row <= rings; row++) {
    const phi = Math.PI * row / rings
    for (let column = 0; column <= sectors; column++) {
      const angle = sectionStart + (sectionEnd - sectionStart) * column / sectors
      points.push(RX * Math.sin(phi) * Math.sin(angle), membraneCenterY + RY * Math.cos(phi), RZ * Math.sin(phi) * Math.cos(angle))
      const current = row * (sectors + 1) + column
      if (row && column) {
        const above = current - sectors - 1
        triangles.push(current, above, current - 1, current - 1, above, above - 1)
      }
    }
  }
  const shell = new T.BufferGeometry()
  shell.setAttribute('position', new T.Float32BufferAttribute(points, 3))
  shell.setIndex(triangles)
  shell.computeVertexNormals()
  return shell
}

export function makeCells(sphere: T.BufferGeometry) {
  const group = new T.Group()
  const receiving = new T.Group()
  group.add(receiving)

  const axon = finish('#ad795d', { roughness: 0.62 })
  const axonTip = finish('#a96d51', { roughness: 0.52, emissive: '#bd5b28', emissiveIntensity: 0 })
  const axonInterior = finish('#825e54')
  const membrane = finish('#7c9a87', { transparent: true, opacity: 0.54, side: T.DoubleSide, depthWrite: false })
  const innerRim = finish('#72947e')
  const outerRim = finish('#a8bca6')
  const cytoplasm = finish('#a6b7a4', { roughness: 0.85 })
  const nucleus = finish('#b18d76', { roughness: 0.66 })
  const nucleolus = finish('#89594f')
  const organelle = finish('#b89068', { roughness: 0.58 })
  const organelleFold = finish('#e3c7a0')
  const er = finish('#728d80')
  const drug = finish(cellColors.treatment, { emissive: '#a54b3a', emissiveIntensity: 0.18 })
  const cgrp = finish(cellColors.cgrp, { emissive: '#dd8d2a', emissiveIntensity: 0.22 })
  const pacap = finish(cellColors.pacap, { emissive: '#278271', emissiveIntensity: 0.29 })
  const releaseColor = new T.MeshBasicMaterial({ color: '#ffd488' })

  const branches: Point[][] = [
    [[-4.38, -0.50, -0.26], [-3.69, -0.37, -0.25], [-3.07, -0.22, -0.24], [-2.55, 0.18, -0.25], [-2.09, 0.42, -0.24]],
    [[-3.54, -0.34, -0.25], [-3.19, -0.26, -0.11], [-2.84, -0.50, 0.13], [-2.30, -0.64, 0.37]],
    [[-3.34, -0.29, -0.25], [-3.12, 0.10, -0.36], [-2.87, 0.58, -0.46], [-2.48, 0.74, -0.51]],
  ]
  const axonPulses = branches.map((points, index) => {
    const path = curve(points)
    const tip = points[points.length - 1]
    tube(group, path, index === 0 ? 0.25 : 0.135, axon)
    tube(group, path, index === 0 ? 0.126 : 0.070, axonInterior)
    oval(group, sphere, axonTip, tip, [0.31, 0.235, 0.228])
    const vesicles = Array.from({ length: 6 }, (_, i) => {
      const phi = i * 2.39996
      return oval(group, sphere, i % 2 === 0 ? cgrp : pacap,
        [tip[0] + 0.07 + Math.cos(phi) * 0.12, tip[1] + Math.sin(phi) * 0.12, tip[2] + 0.184],
        [0.033, 0.033, 0.033])
    })
    const bead = oval(group, sphere, releaseColor, [0, 0, 0], [0.073, 0.073, 0.073])
    const ring = oval(group, new T.TorusGeometry(0.25, 0.035, 8, 27), drug, [tip[0] + 0.11, tip[1], tip[2] + 0.20], [1, 0.87, 1])
    return { path, bead, ring, vesicles }
  })

  const shell = mesh(receiving, ellipsoidSurface(), membrane)
  shell.renderOrder = 2
  for (const [radius, color] of [[0.031, outerRim], [0.022, innerRim]] as const) {
    for (const angle of [sectionStart, sectionEnd]) {
      const points = Array.from({ length: 25 }, (_, i): Point => {
        const phi = Math.PI * i / 24
        const inset = color === innerRim ? 0.964 : 1
        return [inset * RX * Math.sin(phi) * Math.sin(angle), membraneCenterY + inset * RY * Math.cos(phi), inset * RZ * Math.sin(phi) * Math.cos(angle)]
      })
      line(receiving, points, radius, color)
    }
  }
  oval(receiving, sphere, cytoplasm, [0, -0.06, -0.25], [1.24, 1.27, 0.76])
  oval(receiving, sphere, nucleus, [0.20, 0.10, 0.38], [0.49, 0.51, 0.38])
  oval(receiving, sphere, nucleolus, [0.37, 0.20, 0.715], [0.127, 0.11, 0.06])

  for (const [cx, cy, angle] of [[-0.58, 0.72, 0.38], [0.63, -0.57, -0.36], [-0.45, -0.68, -0.15]]) {
    const cluster = new T.Group()
    cluster.position.set(cx, cy, 0.53)
    cluster.rotation.z = angle
    receiving.add(cluster)
    oval(cluster, sphere, organelle, [0, 0, 0], [0.26, 0.105, 0.10])
    for (let fold = -2; fold <= 2; fold++) {
      const x = fold * 0.07
      line(cluster, [[x - 0.022, -0.061, 0.073], [x - 0.026, -0.013, 0.097], [x + 0.028, 0.016, 0.097], [x + 0.021, 0.062, 0.067]], 0.011, organelleFold)
    }
  }
  for (const y of [-0.34, -0.27, -0.20, -0.13]) {
    line(receiving, [[-0.81, y - 0.07, 0.40], [-0.64, y, 0.55], [-0.41, y + 0.03, 0.59], [-0.25, y + 0.08, 0.53]], 0.016, er)
  }

  const stemGeometry = new T.CylinderGeometry(0.024, 0.029, 0.19, 8)
  const bindingGeometry = new T.TorusGeometry(0.062, 0.019, 6, 14)
  const boundGeometry = new T.SphereGeometry(0.054, 10, 8)
  const blockGeometry = new T.BoxGeometry(0.103, 0.042, 0.103)
  const receptors = Array.from({ length: 18 }, (_, i) => {
    const pathway: Pathway = i % 2 === 0 ? 'cgrp' : 'pacap'
    const index = Math.floor(i / 2)
    const color = pathway === 'cgrp' ? cgrp : pacap
    const site = new T.Group()
    receiving.add(site)
    const theta = -1.15 - (index % 3) * 0.33 - (i % 2) * 0.17
    const phi = 0.78 + Math.floor(index / 3) * 0.56 + (i % 2) * 0.13
    const radial = v([Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)])
    site.position.set(radial.x * RX, membraneCenterY + radial.y * RY, radial.z * RZ)
    site.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), radial)
    mesh(site, stemGeometry, color)
    const pocket = mesh(site, bindingGeometry, color)
    pocket.position.y = 0.108
    pocket.rotation.x = Math.PI / 2
    const ligand = mesh(site, boundGeometry, color)
    ligand.position.y = 0.16
    const block = mesh(site, blockGeometry, drug)
    block.position.y = 0.144
    block.rotation.y = Math.PI / 4
    return { site, ligand, block, pathway, index }
  })

  const cgrpParticle = new T.SphereGeometry(0.089, 12, 9)
  const pacapParticle = new T.OctahedronGeometry(0.105)
  const particles = Array.from({ length: 64 }, (_, index) => {
    const pathway: Pathway = index % 2 === 0 ? 'cgrp' : 'pacap'
    const point = mesh(group, pathway === 'cgrp' ? cgrpParticle : pacapParticle, pathway === 'cgrp' ? cgrp : pacap)
    return { point, index: Math.floor(index / 2), pathway }
  })
  const responses = Array.from({ length: 24 }, (_, i) => {
    const phi = i * 2.39996
    const distance = 0.50 + (i % 5) * 0.08
    return oval(receiving, sphere, i % 2 === 0 ? cgrp : pacap, [Math.cos(phi) * distance, Math.sin(phi) * distance, 0.75], [0.04, 0.04, 0.04])
  })

  const arm = new T.CylinderGeometry(0.029, 0.029, 0.25, 8)
  const antibodies = Array.from({ length: 9 }, (_, index) => {
    const antibody = new T.Group()
    group.add(antibody)
    mesh(antibody, arm, drug).position.y = -0.095
    for (const side of [-1, 1]) {
      const tip = mesh(antibody, arm, drug)
      tip.position.set(side * 0.07, 0.11, 0)
      tip.rotation.z = -side * 0.61
    }
    antibody.rotation.set(0.18, index * 2.4, index % 2 ? 0.32 : -0.22)
    const ligand = oval(antibody, sphere, cgrp, [0.137, 0.219, 0], [0.067, 0.067, 0.067])
    return { antibody, ligand }
  })
  const focusMaterial = new T.MeshBasicMaterial({
    color: cellColors.treatment, transparent: true, opacity: 0.43, side: T.DoubleSide, depthWrite: false,
  })
  const targetHalo = mesh(group, new T.RingGeometry(0.235, 0.257, 44), focusMaterial)
  return {
    group,
    update(sample: Sample, settings: Factors, effect?: SceneEffect) {
      receiving.position.x = 0.96 + settings.distance * 0.031
      const released = Math.min(1, (sample.releasedCgrp + sample.releasedPacap) / 2.5)
      const signal = Math.max(sample.cgrpSignal, sample.pacapSignal)
      axonTip.emissiveIntensity = released * 0.94
      cytoplasm.emissive.set('#c6a778')
      cytoplasm.emissiveIntensity = signal * 0.42
      const strength = effect ? sample.engagement : 0
      targetHalo.visible = Boolean(effect && strength < 0.055)
      if (effect?.target === 'release') targetHalo.position.set(-2.11, 0.42, 0.14)
      else if (effect?.target === 'messenger') targetHalo.position.set((receiving.position.x - 3.1) / 2, 0.20, 0.65)
      else targetHalo.position.set(receiving.position.x - 1.12, 0.14, 0.57)
      axonPulses.forEach(({ path, bead, ring, vesicles }, index) => {
        bead.visible = released > 0.03
        if (bead.visible) path.getPointAt((sample.time * 0.14 + index * 0.32) % 1, bead.position).z += 0.23
        ring.visible = effect?.target === 'release' && (index + 0.35) / 3 < strength
        for (let i = 0; i < vesicles.length; i++) {
          const capacity = (i % 2 === 0 ? settings.cgrp : settings.pacap) / 100
          vesicles[i].visible = capacity > 0.025
          vesicles[i].scale.setScalar(0.019 + capacity * 0.036 + 0.025 * released * (0.65 + 0.35 * Math.sin(sample.time * 0.8 + i)))
        }
      })
      for (const { point, index, pathway } of particles) {
        const free = pathway === 'cgrp' ? sample.freeCgrp : sample.freePacap
        point.visible = index < Math.ceil(32 * Math.min(1, free * 1.65))
        if (!point.visible) continue
        const drift = (index * 0.618034 + sample.time * (0.015 + settings.diffusion / 1300)) % 1
        const end = receiving.position.x - 1.11
        point.position.set(-1.99 + drift * (end + 1.99),
          Math.sin(index * 2.33 + drift * 3) * 0.58 + drift * 0.28,
          0.13 + Math.sin(index * 2.02) * 0.54)
        point.scale.setScalar(Math.min(1.22, 0.43 + free * 1.3))
        point.rotation.set(sample.time * 0.14, index * 0.42, 0)
      }
      for (const { site, ligand, block, pathway, index } of receptors) {
        site.visible = pathway === 'pacap' || index < Math.round(settings.receptors * 0.09)
        const engaged = pathway === 'cgrp' ? sample.cgrpOccupied : sample.pac1Occupied
        block.visible = effect?.target === 'receptor' && effect.pathway === pathway && index < Math.ceil(strength * 9)
        ligand.visible = !block.visible && index < Math.ceil(engaged * 9)
        site.scale.setScalar(1 + engaged * 0.22)
      }
      responses.forEach((dot, i) => {
        const activation = i % 2 === 0 ? sample.cgrpSignal : sample.pacapSignal
        dot.visible = Math.floor(i / 2) < Math.ceil(activation * 12)
        dot.scale.setScalar(0.025 + activation * 0.08)
      })
      antibodies.forEach(({ antibody, ligand }, index) => {
        antibody.visible = effect?.target === 'messenger' && index < Math.ceil(strength * 9)
        const drift = (index / 9 + sample.time * 0.025) % 1
        antibody.position.set(-1.70 + drift * (receiving.position.x + 0.39), 0.49 + (index % 3) * 0.20, 0.48 + Math.sin(index * 2.4) * 0.22)
        ligand.material = effect?.pathway === 'pacap' ? pacap : cgrp
        const active = effect?.pathway === 'pacap' ? sample.releasedPacap + sample.freePacap : sample.releasedCgrp + sample.freeCgrp
        ligand.visible = active > 0.03
      })
    },
  }
}
