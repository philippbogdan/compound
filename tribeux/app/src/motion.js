// Shared motion vocabulary for the app.
// ease-out-quint matches --ease-out-5 in index.css. Page-level motion uses
// the materialize recipe (opacity + translateY + blur) at conservative
// magnitudes so the comic-zine elements don't fight the transition.

export const EASE_OUT_QUINT = [0.23, 1, 0.32, 1]

export const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 8, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit:    { opacity: 0, y: -6, filter: 'blur(6px)' },
}

export const PAGE_TRANSITION = {
  duration: 0.38,
  ease: EASE_OUT_QUINT,
}
