import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = mkdtempSync(join(tmpdir(), 'migraine-lab-package-'))
const npm = (args, cwd = directory) => execFileSync('npm', args, { cwd, encoding: 'utf8' })
const node = code => execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: directory, encoding: 'utf8' })

try {
  const [archive] = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', directory], root))
  const paths = archive.files.map(file => file.path)
  for (const path of [
    'ANATOMY.md', 'dist/core/index.js', 'dist/core/index.d.ts', 'dist/react/index.js', 'dist/react/index.d.ts', 'dist/styles.css',
    'dist/react/data/adult-woman-data.js', 'dist/react/data/adult-man-data.js', 'dist/react/data/human-brain-data.js', 'dist/react/data/receptor-helices.json', 'dist/react/data/6e3y.json', 'dist/react/data/6m1i.json',
    'dist/react/MigrainePathway.js', 'dist/react/PathwayHeadMap.js', 'dist/react/ReceptorMicroscope.js', 'dist/react/data/cgrp-binding.json',
  ]) assert(paths.includes(path), path)
  assert(!paths.some(path => /^(?:src|demo|tests|scripts)\//.test(path)))
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', './' + archive.filename])
  const lock = JSON.parse(readFileSync(join(directory, 'package-lock.json'), 'utf8'))
  assert(!lock.packages['node_modules/react'])
  node([
    "import assert from 'node:assert/strict';",
    "import { compareEpisode, sampleAt } from '@esmirnov.ai/migraine-lab/core';",
    "const run = compareEpisode({ factors: { aura: true } });",
    "assert(sampleAt(run.baseline, 18).auraFront > 0);",
  ].join('\n'))
  for (const version of ['18.3.1', '19.2.6']) {
    npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', 'react@' + version, 'react-dom@' + version])
    node([
      "import assert from 'node:assert/strict';",
      "import React from 'react';",
      "import { renderToString } from 'react-dom/server';",
      "import { MigraineLab } from '@esmirnov.ai/migraine-lab';",
      "import { MigraineLab as Alias } from '@esmirnov.ai/migraine-lab/react';",
      "import { FACTORS, TRIGGERS } from '@esmirnov.ai/migraine-lab/core';",
      "assert.equal(MigraineLab, Alias);",
      "const liveLab = renderToString(React.createElement(MigraineLab));",
      "assert(liveLab.includes('data-station=\"cortex\"') && liveLab.includes('data-playing=\"true\"'));",
      "assert.equal((liveLab.match(/role=\"tab\"/g) ?? []).length, 6);",
      "assert.equal((liveLab.match(/class=\"mp-map-label\"/g) ?? []).length, 4);",
      "for (const label of ['Pathway', 'Her vision', 'Drug binding', 'Pain recovery']) assert(liveLab.includes(label), label);",
      "assert(!/<(?:select|canvas)\\b/.test(liveLab) && !liveLab.includes('Trigger migraine'));",
      "const overview = renderToString(React.createElement(MigraineLab, { initialMode: 'walkthrough' }));",
      "assert.equal((overview.match(/class=\"mw-view\"/g) ?? []).length, 6);",
      "assert(!overview.includes('<select'));",
      "const html = renderToString(React.createElement(MigraineLab, { initialMode: 'explore', initialBody: 'male', initialFactors: { aura: true, recoverySpeed: 65 } }));",
      "assert(html.includes('Male anatomy'));",
      "assert(html.includes('checked=\"\"') && !html.includes('<select'));",
      "for (const { key } of FACTORS) assert(html.includes('data-factor=\"' + key + '\"'), key);",
      "for (const { name } of TRIGGERS) assert(html.includes(name), name);",
    ].join('\n'))
  }
  console.log('Packed headless API and React 18 and 19 imports passed.')
} finally {
  rmSync(directory, { recursive: true, force: true })
}
