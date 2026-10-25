import { useEffect, useRef, useState } from 'react'
import { WORLDS } from '../game/worlds.js'
import { view } from '../lib/leaderboard.js'
import Avatar from './Avatar.jsx'
import { CubeIcon, Page, Tag } from './ui.jsx'

const MEDAL = [
  'bg-gradient-to-b from-[#FFE27A] to-[#F5A623] text-[#3A2300]',
  'bg-gradient-to-b from-[#F4F7FB] to-[#A9B4C6] text-[#1B2230]',
  'bg-gradient-to-b from-[#F0B27A] to-[#B8692B] text-[#2E1500]',
]

function Rank({ n }) {
  return n <= 3 ? (
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-[3px] border-ink font-display text-[15px] font-black ${MEDAL[n - 1]}`}>{n}</span>
  ) : (
    <span className="w-8 shrink-0 text-center font-display text-[16px] font-extrabold text-label-secondary">{n}</span>
  )
}

function Row({ rank, entry, isMe }) {
  return (
    <li className={`slot flex items-center gap-3 px-3 py-1.5 ${isMe ? 'bg-[#2B2410] ring-[3px] ring-coin' : ''}`}>
      <Rank n={rank} />
      <Avatar color={entry.color} size={30} />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-display text-[17px] font-extrabold">{entry.name}</span>
        {entry.bot && <Tag className="bg-white/10 text-label-secondary">Bot</Tag>}
        {isMe && <Tag className="bg-coin text-[#3A2300]">You</Tag>}
      </span>
      <span className="font-pixel text-[17px] font-black tabular-nums text-coin">{entry.score.toLocaleString()}</span>
    </li>
  )
}

// Top 10 for a world, plus the player's own row (with rank) when they're outside it.
export function Board({ worldId, profile, refresh, className = '' }) {
  const [v, setV] = useState(null)
  useEffect(() => {
    let live = true
    view(worldId, profile).then((r) => live && setV({ ...r, worldId }))
    return () => {
      live = false
    }
  }, [worldId, profile, refresh])
  if (!v || v.worldId !== worldId) return <p className="px-2 py-6 text-center text-[14px] text-label-secondary" role="status">Loading scores…</p>
  return (
    <ol className={`flex flex-col gap-2 ${className}`} aria-label="Top 10">
      {v.top.map((e, i) => (
        <Row key={e.id} rank={i + 1} entry={e} isMe={e.id === profile?.id} />
      ))}
      {v.me && !v.inTop && (
        <>
          <li className="text-center font-display text-[18px] leading-none text-label-tertiary" aria-hidden="true">⋮</li>
          <Row rank={v.me.rank} entry={v.me.entry} isMe />
        </>
      )}
      {!v.me && profile && (
        <li className="px-2 py-1 text-center text-[14px] text-label-secondary">Finish a run in this world to get on the board.</li>
      )}
    </ol>
  )
}

export default function Leaderboard({ worldId, profile, onSelectWorld, onBack }) {
  const tabs = useRef(null)
  useEffect(() => {
    tabs.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [worldId])
  return (
    <Page title="Leaderboard" onBack={onBack}>
      <div ref={tabs} className="touch-pan-x -mx-1 flex gap-2 overflow-x-auto px-1 pb-3 pt-1" role="tablist" aria-label="World">
        {WORLDS.map((w) => {
          const on = w.id === worldId
          return (
            <button
              key={w.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onSelectWorld(w.id)}
              className={`chunk flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap px-4 font-display text-[15px] font-black ${on ? 'btn-gold' : 'btn-dark'}`}
            >
              {w.name}
              {w.kind === '3d' && <CubeIcon />}
            </button>
          )
        })}
      </div>
      <Board worldId={worldId} profile={profile} />
      <p className="mt-4 px-2 text-center text-[13px] leading-snug text-label-tertiary">
        One global board for every player. Rival bots fill the empty spots so there is always someone to beat.
      </p>
    </Page>
  )
}
