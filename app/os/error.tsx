'use client'

import { useEffect } from 'react'

export default function OsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div role="alert" className="flex flex-col gap-4 rounded-xl border border-alert/40 bg-alert-soft p-6 text-alert">
      <h1 className="text-2xl">পাতাটি লোড করা যায়নি</h1>
      <p className="max-w-xl text-sm leading-relaxed">
        ডেটাবেসের সংযোগে বা সাময়িক কোনো সমস্যা হয়েছে। আপনার আগের কাজ সংরক্ষিত আছে। আবার চেষ্টা করুন; সমস্যা থেকে গেলে নিচের কোডটি সহায়তা দলকে জানান।
      </p>
      {error.digest ? <code className="font-mono text-xs">{error.digest}</code> : null}
      <button type="button" onClick={reset} className="btn self-start">
        আবার চেষ্টা করুন
      </button>
    </div>
  )
}
