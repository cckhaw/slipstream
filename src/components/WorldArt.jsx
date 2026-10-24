// Tiny SVG scenes used as world-card thumbnails.
const INK = '#05070C'

const Iso = ({ x, y, s, top, left, right }) => (
  <g stroke={INK} strokeWidth="1.5" strokeLinejoin="round">
    <polygon points={`${x},${y - s} ${x + s},${y - s / 2} ${x},${y} ${x - s},${y - s / 2}`} fill={top} />
    <polygon points={`${x - s},${y - s / 2} ${x},${y} ${x},${y + s} ${x - s},${y + s / 2}`} fill={left} />
    <polygon points={`${x + s},${y - s / 2} ${x},${y} ${x},${y + s} ${x + s},${y + s / 2}`} fill={right} />
  </g>
)

const SCENES = {
  neon: (
    <>
      <rect width="160" height="90" fill="#0A0D14" />
      <g stroke="rgba(255,255,255,.07)">{[20, 50, 80, 110, 140].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="66" />)}</g>
      <rect y="66" width="160" height="24" fill="#FF2D55" opacity=".6" />
      <rect y="64" width="160" height="3" fill="#FF2D55" />
      <g stroke="#fff" strokeWidth="2.5" fill="none" opacity=".6" strokeLinecap="round">{[10, 50, 90, 130].map((x) => <path key={x} d={`M${x} 71 l6 5 -6 5`} />)}</g>
      <circle cx="40" cy="58" r="9" fill="#00F5D4" />
      <circle cx="40" cy="58" r="16" fill="#00F5D4" opacity=".18" />
      <rect x="116" y="38" width="8" height="28" fill="#FF9500" opacity=".7" />
      <circle cx="120" cy="38" r="6" fill="#FF9500" /><circle cx="120" cy="38" r="2.5" fill="#fff" />
    </>
  ),
  quarry: (
    <>
      <rect width="160" height="90" fill="#7CC8FF" />
      <rect x="118" y="10" width="20" height="20" fill="#FFF3A0" />
      <rect x="20" y="22" width="40" height="8" fill="#fff" /><rect x="28" y="16" width="24" height="7" fill="#fff" />
      <rect x="0" y="48" width="50" height="20" fill="#58A85C" /><rect x="50" y="40" width="40" height="28" fill="#3E8E48" /><rect x="90" y="52" width="70" height="16" fill="#58A85C" />
      <rect y="66" width="160" height="6" fill="#FF2D55" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={i * 20} y="72" width="19" height="18" fill={i % 3 ? '#8B5A2B' : '#7D7D7D'} stroke={INK} strokeOpacity=".4" />)}
      <rect x="64" y="72" width="30" height="18" fill="#FF7A00" />
      {[0, 1].map((i) => <g key={i}><rect x="112" y={46 + i * 10} width="14" height="10" fill="#D63A2F" stroke={INK} /><rect x="112" y={49 + i * 10} width="14" height="4" fill="#F5F0E6" /></g>)}
      <rect x="20" y="52" width="14" height="14" fill="#00F5D4" stroke={INK} strokeWidth="2" />
    </>
  ),
  ship: (
    <>
      <rect width="160" height="90" fill="#10172A" />
      <rect width="160" height="14" fill="#1B2540" /><rect y="13" width="160" height="2" fill={INK} />
      {[12, 60, 108].map((x) => <rect key={x} x={x} y="9" width="10" height="3" fill="#FFF6D6" />)}
      <circle cx="80" cy="38" r="17" fill="#3A4668" stroke={INK} strokeWidth="2" /><circle cx="80" cy="38" r="13" fill="#05091A" />
      {[[75, 33], [86, 42], [78, 45], [88, 32]].map(([x, y]) => <rect key={x} x={x} y={y} width="1.5" height="1.5" fill="#fff" />)}
      <rect y="66" width="160" height="5" fill="#FF2D55" /><rect y="71" width="160" height="19" fill="#242E4A" />
      <rect y="84" width="160" height="6" fill="#FFC83D" opacity=".85" />
      <rect x="112" y="46" width="20" height="20" fill="#8791A8" stroke={INK} strokeWidth="2" />
      <rect x="112" y="54" width="20" height="5" fill="#FFC83D" />
      <rect x="32" y="40" width="22" height="26" rx="11" fill="#FF5FBF" stroke={INK} strokeWidth="2" />
      <rect x="43" y="46" width="14" height="9" rx="4.5" fill="#9FE3FF" stroke={INK} strokeWidth="1.5" />
    </>
  ),
  voxel: (
    <>
      <rect width="160" height="90" fill="#8FD3FF" />
      <rect x="110" y="8" width="22" height="22" fill="#FFF3A0" />
      <polygon points="0,58 160,58 160,90 0,90" fill="#58B947" />
      <polygon points="60,90 100,90 120,58 80,58" fill="#9B6B3A" />
      <Iso x={30} y={58} s={16} top="#6BCB5A" left="#8B5A2B" right="#734822" />
      <Iso x={30} y={40} s={10} top="#2E8B3A" left="#27782F" right="#1F6326" />
      <Iso x={126} y={64} s={14} top="#FF6A5C" left="#D63A2F" right="#B02D24" />
      <Iso x={126} y={50} s={14} top="#fff" left="#E8E1D2" right="#CFC7B6" />
      <polygon points="68,80 92,80 96,74 72,74" fill="#FF7A00" />
    </>
  ),
  obby: (
    <>
      <rect width="160" height="90" fill="#6EC8FF" />
      <polygon points="70,40 90,40 160,90 0,90" fill="#E8F1FF" />
      {[0, 1, 2, 3].map((i) => <polygon key={i} points={`${74 - i * 22},${46 + i * 11} ${86 + i * 22},${46 + i * 11} ${88 + i * 25},${50 + i * 12} ${72 - i * 25},${50 + i * 12}`} fill="#C5D8F7" opacity={i % 2 ? 0.6 : 0} />)}
      <polygon points="64,40 70,40 0,90 -10,90" fill="#FFC83D" /><polygon points="96,40 90,40 160,90 170,90" fill="#FFC83D" />
      {[['#FF4D4D', 22, 14], ['#4DD2FF', 14, 28], ['#7BD34F', 132, 18], ['#B14CFF', 128, 34]].map(([c, x, y]) => <rect key={c} x={x} y={90 - y - 8} width="18" height="16" fill={c} stroke={INK} strokeWidth="2" />)}
      <rect x="72" y="56" width="16" height="22" rx="8" fill="#FFC83D" stroke={INK} strokeWidth="2" />
      <rect x="80" y="60" width="9" height="6" rx="3" fill="#9FE3FF" stroke={INK} strokeWidth="1.2" />
    </>
  ),
  grid: (
    <>
      <rect width="160" height="90" fill="#0B0618" />
      <rect y="38" width="160" height="2" fill="#FF2DD1" opacity=".8" />
      <rect y="22" width="160" height="16" fill="#B14CFF" opacity=".16" />
      <g stroke="#B14CFF" strokeOpacity=".7">{[-80, -40, 0, 40, 80, 120, 160, 200, 240].map((x) => <line key={x} x1="80" y1="40" x2={x} y2="90" />)}{[48, 58, 72].map((y) => <line key={y} x1="0" y1={y} x2="160" y2={y} />)}</g>
      <polygon points="74,40 86,40 110,90 50,90" fill="#FF2D55" opacity=".35" />
      <polygon points="30,38 40,20 50,38" fill="none" stroke="#00F5D4" strokeWidth="1.5" />
      <rect x="116" y="24" width="10" height="14" fill="none" stroke="#FF9500" strokeWidth="2" />
      <circle cx="80" cy="70" r="7" fill="#B14CFF" /><circle cx="80" cy="70" r="13" fill="#B14CFF" opacity=".25" />
    </>
  ),
}

export default function WorldArt({ theme, className = '' }) {
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true" shapeRendering="crispEdges">
      {SCENES[theme]}
    </svg>
  )
}
