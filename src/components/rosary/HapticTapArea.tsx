import type { ReactNode } from 'react'

// The one web haptic that survives on iOS (probe test G, public/haptics-test.html):
// a REAL finger tap on a <label> whose <input type="checkbox" switch> is visually
// hidden still produces the native switch tick. Programmatic label.click() is
// patched (iOS 26.5), so the tap surface itself must be the label — the tick and
// the advance are the same gesture, wired through the input's change event.
//
// The switch must stay rendered (1×1px, opacity 0) — display:none kills the tick.
// It is uncontrolled on purpose: only the toggle gesture matters, never the value.
//
// haptic={false} renders a plain tappable div instead — no switch, no tick.
// Silent steps are the look-at-the-screen ones (anúncio, scroll pages): every
// prayer prayed from memory ticks. iOS offers exactly one fixed tick per real
// tap and no vibration API, so a distinct decade-end sensation can only come
// from MORE REAL TAPS — the Glória requires three (see RosaryPrayerView).

// React's TS types don't know the non-standard iOS `switch` attribute.
declare module 'react' {
  interface InputHTMLAttributes<T> {
    switch?: string
  }
}

interface HapticTapAreaProps {
  haptic: boolean
  onTap: () => void
  className?: string
  children: ReactNode
}

export function HapticTapArea({ haptic, onTap, className, children }: HapticTapAreaProps) {
  if (!haptic) {
    return (
      <div role="button" tabIndex={-1} onClick={onTap} className={className}>
        {children}
      </div>
    )
  }
  return (
    <label className={`relative ${className ?? ''}`}>
      {children}
      <input
        type="checkbox"
        switch=""
        onChange={() => {
          // Android's counterpart nicety; iOS has no navigator.vibrate.
          navigator.vibrate?.(15)
          onTap()
        }}
        className="absolute left-1 bottom-1 w-px h-px opacity-0"
        aria-hidden
        tabIndex={-1}
      />
    </label>
  )
}
