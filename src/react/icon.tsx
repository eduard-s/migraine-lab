const paths = {
  body: 'M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 9l7 1 7-1m-7 1v5m0 0-4 7m4-7 4 7',
  head: 'M10 5a3 3 0 0 0-5 2 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 5 2m0-14v14m4-14a3 3 0 0 1 5 2 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-5 2m0-14v14',
  cells: 'M10 3h4v4h-4zM3 17h4v4H3zm14 0h4v4h-4zM12 7v5m-7 5v-5h14v5',
  receptor: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-11 2 2',
  rotate: 'M20 5v5h-5M20 10a8 8 0 1 0 .1 5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  hydration: 'M12 2C9 6 5 10 5 15a7 7 0 0 0 14 0c0-5-4-9-7-13Z',
  hormones: 'M20 7h-5V2m5 5a8 8 0 1 0 .1 9M4 17h5v5',
  caffeine: 'M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm13 1h2a2 2 0 1 1 0 4h-2M8 2v3m5-3v3',
  light: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-14v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  reset: 'M4 5v5h5m-5 0a8 8 0 1 1-.1 5',
  crosshair: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 2v5m0 10v5M2 12h5m10 0h5',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  external: 'M6 18 18 6M8 6h10v10',
  weather: 'M5 16a4 4 0 0 1 1-7.9A6 6 0 0 1 17.7 9a3.5 3.5 0 0 1 1.8 6.5M8 16l-2 4m7-4-2 4m7-4-2 4',
  sleep: 'M20 15A8.2 8.2 0 0 1 9 4a8.7 8.7 0 1 0 11 11Z',
  meal: 'M4 3v5a3 3 0 0 0 6 0V3M7 3v18m10-18c-2 2-3 5-3 9h4V3m0 9v9',
  stress: 'M2 12h5l3-7 4 14 3-7h5',
  noise: 'M3 9h4l5-4v14l-5-4H3V9Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  odor: 'M3 7h11a3 3 0 1 0-3-3M3 12h16a2 2 0 1 1-2 2M3 17h8a2 2 0 1 1-2 2',
  alcohol: 'M7 3h10l1 5a6 6 0 0 1-12 0l1-5Zm5 11v7m-4 0h8M6 8h12',
  exertion: 'm13 2-8 12h6l-1 8 9-12h-6l1-8',
  eye: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  play: 'm8 5 12 7-12 7V5Z',
  pause: 'M9 5v14m6-14v14',
  random: 'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c1.6 0 3-1.3 4-3m4-6c1-2 2.5-3 4-3h3m-4-4 4 4-4 4',
  download: 'M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5',
  check: 'm5 12 4 4 10-10',
  pin: 'm15 4 5 5-3 1-3 4v4l-2 1-3-3-5 5m5-5-3-3 1-2h4l4-3V4Z',
  close: 'm6 6 12 12M18 6 6 18',
  zoom: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16 16l4.5 4.5M7.5 10.5h6m-3-3v6',
} as const

export function Icon({ name, size = 16 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={paths[name]} />
  </svg>
}
