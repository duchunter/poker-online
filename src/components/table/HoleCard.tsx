'use client'

// A hole card at a multiplayer table: dealt face down in your card back, and
// turned over by a tap — or peeled. Hold a corner and lift it, and the card
// folds back along a crease that follows your finger, the face showing on the
// underside of the flap, the way you squeeze a card at a real table. Let go
// far enough in and it turns over; short of that it falls back down.
//
// The fold is plain 2D geometry. The crease is the perpendicular bisector of
// the corner and the point it has been dragged to. The part of the card on the
// corner's side of the crease is lifted: cut out of the back, and drawn again,
// face side, reflected across the crease.

import { useEffect, useRef, useState } from 'react'
import { type AnimationPlaybackControls, animate, motion } from 'framer-motion'
import { CardBack } from '@/components/CardBack'
import { type CardSize, PlayingCard } from '@/components/PlayingCard'
import type { CardBackDesign } from '@/config/cardBacks'
import type { Card } from '@/lib/poker/cards'
import { cn } from '@/lib/utils'

type Pt = { x: number; y: number }

/** Lifted past this share of the card, letting go turns it over. */
const COMMIT = 0.4
/** Pointer travel, in px, before a press stops being a tap. */
const SLOP = 5

/** A peel in progress: the card's size, the corner held, where it is now. */
type Peel = { w: number; h: number; corner: Pt; to: Pt }

/**
 * A hole card that deals in face down and turns over on cue: the board's flip
 * (`BoardCard`), held until you look. With `onPeeled`, it can be peeled too.
 */
export function HoleCard({
  card,
  index,
  size,
  back,
  faceUp,
  onPeeled,
  className,
  faceClassName,
}: {
  card: Card
  index: number
  size: CardSize
  back: CardBackDesign
  faceUp: boolean
  /** Face down and yours to look at: a peel let go past halfway lands here. */
  onPeeled?: () => void
  /** Placement (the fan's tilt): on a wrapper, clear of the flip's transform. */
  className?: string
  faceClassName?: string
}) {
  const [peel, setPeel] = useState<Peel | null>(null)
  /** A peel that turned the card over: the flip is already done, so no flip. */
  const [instant, setInstant] = useState(false)
  const gesture = useRef<{ start: Pt; corner: Pt; w: number; h: number; moved: boolean } | null>(
    null,
  )
  const latest = useRef<Peel | null>(null)
  const fallBack = useRef<AnimationPlaybackControls | null>(null)
  /** A drag ends in a click on the button around the card; that one is not a tap. */
  const swallowClick = useRef(false)
  const peelable = Boolean(onPeeled) && !faceUp

  useEffect(() => () => fallBack.current?.stop(), [])

  const show = (p: Peel | null) => {
    latest.current = p
    setPeel(p)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    swallowClick.current = false
    if (!peelable || (e.pointerType === 'mouse' && e.button !== 0)) return
    fallBack.current?.stop()
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const w = el.offsetWidth
    const h = el.offsetHeight
    const x = ((e.clientX - rect.left) * w) / rect.width
    const y = ((e.clientY - rect.top) * h) / rect.height
    // Whichever corner the press is nearest is the one you are holding.
    const corner = { x: x < w / 2 ? 0 : w, y: y < h / 2 ? 0 : h }
    gesture.current = { start: { x: e.clientX, y: e.clientY }, corner, w, h, moved: false }
    el.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.start.x
    const dy = e.clientY - g.start.y
    if (!g.moved && Math.hypot(dx, dy) < SLOP) return
    g.moved = true
    show({ w: g.w, h: g.h, corner: g.corner, to: { x: g.corner.x + dx, y: g.corner.y + dy } })
  }

  const onPointerEnd = () => {
    const g = gesture.current
    gesture.current = null
    if (!g?.moved) return
    swallowClick.current = true
    const p = latest.current
    if (!p) return
    const shape = peelShape(p)
    if (shape && shape.lifted >= COMMIT) {
      setInstant(true)
      show(null)
      onPeeled?.()
      return
    }
    // Not far enough: the corner drops back to the felt.
    const from = p.to
    fallBack.current = animate(0, 1, {
      type: 'spring',
      stiffness: 420,
      damping: 30,
      onUpdate: (t) =>
        show({
          ...p,
          to: { x: from.x + (p.corner.x - from.x) * t, y: from.y + (p.corner.y - from.y) * t },
        }),
      onComplete: () => show(null),
    })
  }

  const shape = peel ? peelShape(peel) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: -14, rotate: -4, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: index * 0.06 }}
    >
      <div
        className={cn(className, peelable && 'select-none')}
        style={{ perspective: 900, touchAction: peelable ? 'none' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          if (!swallowClick.current) return
          swallowClick.current = false
          e.stopPropagation()
          e.preventDefault()
        }}
      >
        <motion.div
          className="relative"
          style={{ transformStyle: 'preserve-3d' }}
          initial={false}
          animate={{ rotateY: faceUp ? 0 : 180 }}
          transition={
            instant
              ? { duration: 0 }
              : { type: 'spring', stiffness: 170, damping: 19, delay: index * 0.05 }
          }
          onAnimationComplete={() => {
            if (instant) setInstant(false)
          }}
        >
          <div style={{ backfaceVisibility: 'hidden' }} aria-hidden={!faceUp}>
            <PlayingCard card={card} size={size} className={faceClassName} />
          </div>
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {shape ? (
              <>
                {shape.rest.length >= 3 && (
                  <div className="absolute inset-0" style={{ clipPath: polygon(shape.rest) }}>
                    <CardBack design={back} size={size} className={faceClassName} />
                  </div>
                )}
                {shape.flap.length >= 3 && (
                  <div className="pointer-events-none absolute inset-0 drop-shadow-lg">
                    <div
                      className="absolute left-0 top-0"
                      style={{
                        transformOrigin: '0 0',
                        transform: shape.matrix,
                        clipPath: polygon(shape.flap),
                      }}
                    >
                      <PlayingCard card={card} size={size} className="shadow-none dark:shadow-none" />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <CardBack design={back} size={size} className={faceClassName} />
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

/**
 * The fold for a peel: what is left of the back, the flap's outline in the
 * face's own coordinates, the transform that lays the face over the crease,
 * and how much of the card is lifted (0–1). Null while nothing is lifted.
 */
function peelShape({ w, h, corner, to }: Peel) {
  // A corner can only be lifted in over the card; pulled outward it stays put.
  const sx = corner.x === 0 ? 1 : -1
  const sy = corner.y === 0 ? 1 : -1
  let dx = Math.max(0, sx * (to.x - corner.x))
  let dy = Math.max(0, sy * (to.y - corner.y))
  let len = Math.hypot(dx, dy)
  if (len < 1) return null
  const max = Math.hypot(w, h) * 1.2
  if (len > max) {
    dx *= max / len
    dy *= max / len
    len = max
  }
  // The crease: through the midpoint of corner and finger, square to the pull.
  const n = { x: (sx * dx) / len, y: (sy * dy) / len }
  const m = { x: corner.x + (sx * dx) / 2, y: corner.y + (sy * dy) / 2 }
  const card = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]
  const lifted = clipHalf(card, m, n, -1)
  const rest = clipHalf(card, m, n, 1)

  // Face down, the face is the back mirrored. Its rank and suit run down its
  // left edge, so it is mirrored whichever way puts that edge under the corner
  // you hold: across the card for the right-hand corners, end over end for the
  // left. Either way the first thing a peel shows is an index.
  const fx = corner.x === w ? -1 : 1
  const fy = corner.x === w ? 1 : -1
  const tx = fx === -1 ? w : 0
  const ty = fy === -1 ? h : 0
  const mirror = (q: Pt) => ({ x: fx * q.x + tx, y: fy * q.y + ty })

  // Reflection across the crease, after that mirror: two reflections, so the
  // face comes out turned, never back to front.
  const k = 2 * (m.x * n.x + m.y * n.y)
  const rxx = 1 - 2 * n.x * n.x
  const rxy = -2 * n.x * n.y
  const ryy = 1 - 2 * n.y * n.y
  const a = rxx * fx
  const b = rxy * fx
  const c = rxy * fy
  const d = ryy * fy
  const e = rxx * tx + rxy * ty + k * n.x
  const f = rxy * tx + ryy * ty + k * n.y

  return {
    rest,
    flap: lifted.map(mirror),
    matrix: `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`,
    lifted: area(lifted) / (w * h),
  }
}

/** The part of a convex polygon on one side of a line (Sutherland–Hodgman, one edge). */
function clipHalf(poly: Pt[], m: Pt, n: Pt, sign: 1 | -1): Pt[] {
  const side = (p: Pt) => sign * ((p.x - m.x) * n.x + (p.y - m.y) * n.y)
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const sp = side(p)
    const sq = side(q)
    if (sp >= 0) out.push(p)
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq)
      out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) })
    }
  }
  return out
}

function area(poly: Pt[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    s += p.x * q.y - q.x * p.y
  }
  return Math.abs(s) / 2
}

function polygon(poly: Pt[]): string {
  return `polygon(${poly.map((p) => `${p.x}px ${p.y}px`).join(', ')})`
}
