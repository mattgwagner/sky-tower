import { useEffect, useState } from 'react'
import { play } from '../audio'
import { answerContract, contractProgress, dueText, MAX_OPEN } from '../game/contracts'
import type { Contract } from '../game/contracts'
import { money } from '../game/state'
import type { Controller } from './controller'

function ctl(): Controller {
  return (window as unknown as { skytower: Controller }).skytower
}

const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const MAX_DIGITS = 7

function shown(c: Contract, typed: string) {
  if (!typed) return '?'
  if (c.clock) return typed
  const n = Number(typed)
  return c.dollars ? money(n) : n.toLocaleString('en-US')
}

/** Buttons only: no Enter-to-check, no typing on the keyboard. */
function NumberPad({ c, onRight }: { c: Contract; onRight: (paid: number) => void }) {
  const [typed, setTyped] = useState('')
  const [wrong, setWrong] = useState(false)
  const press = (k: string) => {
    play('click')
    setWrong(false)
    if (k === '⌫') return setTyped((t) => t.slice(0, -1))
    setTyped((t) => {
      if (k === ':' && (t.includes(':') || !t)) return t
      return t.replace(':', '').length >= MAX_DIGITS ? t : t + k
    })
  }
  const check = () => {
    const g = ctl().g
    const before = g.money
    const r = answerContract(g, c.id, typed)
    if (r === 'wrong') { play('boing'); setWrong(true); setTyped('') }
    if (r === 'right') { play('cash'); onRight(g.money - before) }
    ctl().emit()
  }
  return (
    <div className="pad">
      <div className={`pad-show ${wrong ? 'wrong' : ''}`}>{shown(c, typed)}</div>
      {wrong && <p className="pad-hint">Not quite! Try: {c.hint}</p>}
      <div className="pad-keys">
        {PAD.map((k) => <button key={k} onClick={() => press(k)}>{k}</button>)}
        {c.clock ? <button onClick={() => press(':')}>:</button> : <span />}
        <button onClick={() => press('0')}>0</button>
        <button onClick={() => press('⌫')} title="Undo">⌫</button>
      </div>
      <button className="primary pad-check" disabled={!typed} onClick={check}>✅ Check</button>
    </div>
  )
}

function Card({ c, active, onPick, onRight }: { c: Contract; active: boolean; onPick: () => void; onRight: (paid: number) => void }) {
  const g = ctl().g
  const p = contractProgress(g, c)
  const due = dueText(g, c)
  return (
    <div className={`contract ${c.type === 'math' ? 'math' : ''}`}>
      <div className="contract-head">
        <span className="contract-emoji">{c.emoji}</span>
        <b>{c.text}</b>
      </div>
      <div className="contract-foot">
        <span className="contract-reward">+{money(c.reward)}</span>
        {p && <span className="contract-bar"><i style={{ width: `${Math.round((p.have / p.need) * 100)}%` }} /><small>{p.need > 9999 ? `${money(p.have)} / ${money(p.need)}` : `${p.have.toLocaleString('en-US')} / ${p.need.toLocaleString('en-US')}`}</small></span>}
        {due && <span className="contract-due">{due}</span>}
        {c.type === 'math' && !active && <button onClick={() => { play('click'); onPick() }}>✏️ Answer</button>}
      </div>
      {c.type === 'math' && active && <NumberPad key={c.id} c={c} onRight={onRight} />}
    </div>
  )
}

export function ContractBoard({ onClose }: { onClose: () => void }) {
  const g = ctl().g
  const book = g.contracts
  const open = book.open
  const [picked, setPicked] = useState<number | null>(null)
  const [cheer, setCheer] = useState<number | null>(null)
  const active = open.find((c) => c.id === picked && c.type === 'math') ?? open.find((c) => c.type === 'math')
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal contracts" onClick={(e) => e.stopPropagation()}>
        <h2>📋 Contracts</h2>
        {cheer !== null && <p className="contract-cheer">🎉 You got it! +{money(cheer)}</p>}
        {open.length ? (
          <div className="contract-list">
            {open.map((c) => (
              <Card key={c.id} c={c} active={c.id === active?.id} onPick={() => setPicked(c.id)} onRight={(v) => { setCheer(v); setPicked(null) }} />
            ))}
          </div>
        ) : (
          <p>No contracts right now. A new one shows up every morning!</p>
        )}
        <p className="contract-note">
          {open.length >= MAX_OPEN ? 'Board is full. Finish one to make room.' : 'A new contract every morning.'}
          {book.done > 0 && <> · {book.done} done</>}
        </p>
        <div className="row"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

let rang = 0

/** Pops when a build / earn contract finishes out in the tower. */
export function ContractToasts() {
  const current = ctl().contractQueue[0]
  useEffect(() => {
    if (!current) return
    if (rang !== current.id) { rang = current.id; play('cash') }
    const id = current.id
    const t = window.setTimeout(() => {
      const q = ctl().contractQueue
      if (q[0]?.id === id) q.shift()
      ctl().emit()
    }, 2600)
    return () => window.clearTimeout(t)
  }, [current])
  if (!current) return null
  return (
    <div className="sticker-toast contract-toast">
      <span className="contract-emoji">📋</span>
      <div className="sticker-toast-copy">
        <b>Contract done! +{money(current.paid)}</b>
        <small>{current.text}</small>
      </div>
    </div>
  )
}
