import { useState } from 'react'
import { Edit3, Eraser } from 'lucide-react'
import { playUiTick } from '../lib/audio'
import { useOrbit } from '../lib/orbit-context'

const MAX_LENGTH = 600

/**
 * Shared scratchpad card.
 *
 * Sits in the landing bento grid alongside the other glass cards so a note is
 * always one glance away instead of floating over the boards.
 */
export function SharedScratchpad() {
  const { state, setScratchpad, currentUser } = useOrbit()
  const scratchpadText = state.sharedScratchpad?.text ?? ''
  const [draft, setDraft] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  const value = draft !== null ? draft : scratchpadText
  const partnerName = currentUser === 'shivam' ? 'Noor' : currentUser === 'noor' ? 'Shivam' : 'Partner'
  const hasNote = value.trim().length > 0

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = event.target.value
    setDraft(nextVal)
    setScratchpad(nextVal)
  }

  const handleClear = () => {
    setDraft(null)
    setScratchpad('')
    playUiTick()
  }

  return (
    <section className="glass flex flex-col p-4 sm:p-5" aria-label="Shared scratchpad">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={hasNote ? 'text-[#00F2FE]' : 'text-white/45'}>
            <Edit3 className="size-3.5" strokeWidth={1.9} />
          </span>
          <span className="label-mono">Shared Scratchpad</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="metric flex items-center gap-1.5 text-[10px] tracking-[0.12em] text-white/30 uppercase">
            <span
              className={`size-1.5 rounded-full ${
                focused
                  ? 'animate-pulse bg-[#F59E0B] shadow-[0_0_8px_#F59E0B]'
                  : hasNote
                    ? 'bg-[#00F2FE] shadow-[0_0_8px_#00F2FE]'
                    : 'bg-white/25'
              }`}
              aria-hidden="true"
            />
            {focused ? 'Editing' : hasNote ? 'Live' : 'Empty'}
          </span>

          {hasNote && (
            <button
              type="button"
              onClick={handleClear}
              className="grid size-7 place-items-center rounded-full border border-white/[0.08] text-white/40 transition-colors hover:border-[#FF0844]/35 hover:text-[#FF0844]"
              aria-label="Clear the shared scratchpad"
              title="Clear note"
            >
              <Eraser className="size-3.5" strokeWidth={1.9} />
            </button>
          )}
        </div>
      </div>

      <textarea
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          setDraft(null)
        }}
        rows={3}
        maxLength={MAX_LENGTH}
        placeholder={`Leave a quick note, grocery item, or thought for ${partnerName}…`}
        aria-label={`Shared scratchpad note for ${partnerName}`}
        className="w-full flex-1 resize-none rounded-xl border border-white/[0.08] bg-black/20 p-3 text-[12.5px] leading-relaxed text-white/90 transition-all placeholder:text-white/25 focus:border-[#00F2FE]/40 focus:bg-black/40 focus:outline-none"
      />

      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-2.5">
        <span className="metric text-[9.5px] tracking-[0.12em] text-white/30 uppercase">
          Real-time with {partnerName}
        </span>
        <span className="metric text-[9.5px] tracking-[0.12em] text-white/25">
          {value.length}/{MAX_LENGTH} · auto-saved
        </span>
      </div>
    </section>
  )
}
