import { useState } from 'react'
import { Edit3 } from 'lucide-react'
import { useOrbit } from '../lib/orbit-context'

export function SharedScratchpad() {
  const { state, setScratchpad, currentUser } = useOrbit()
  const scratchpadText = state.sharedScratchpad?.text ?? ''
  const [draft, setDraft] = useState<string | null>(null)

  const value = draft !== null ? draft : scratchpadText

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value
    setDraft(nextVal)
    setScratchpad(nextVal)
  }

  const handleBlur = () => {
    setDraft(null)
  }

  const partnerName = currentUser === 'shivam' ? 'Noor' : currentUser === 'noor' ? 'Shivam' : 'Partner'

  return (
    <section className="glass p-4 sm:p-5" aria-label="Shared scratchpad">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[#00F2FE]">
            <Edit3 className="size-3.5" />
          </span>
          <span className="label-mono">Shared Scratchpad</span>
        </div>
        <span className="metric text-[10px] tracking-[0.12em] text-white/30">
          REAL-TIME WITH {partnerName.toUpperCase()}
        </span>
      </div>

      <textarea
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={2}
        placeholder={`Leave a quick note, grocery item, or thought for ${partnerName}...`}
        className="w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 p-3 text-xs text-white/90 placeholder-white/25 focus:border-[#00F2FE]/40 focus:bg-black/40 focus:outline-none transition-all"
      />
    </section>
  )
}
