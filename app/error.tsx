'use client'

import { useEffect } from 'react'

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl leading-tight">সিস্টেম এই মুহূর্তে সাড়া দিচ্ছে না</h1>
      <p className="leading-relaxed text-muted">
        সাধারণত ডেটাবেসের সংযোগ না পেলে এমন হয়। একটু পরে আবার চেষ্টা করুন। আপনি যদি সিস্টেম পরিচালনা করেন, ডেটাবেস যুক্ত আছে কি না এবং <code className="font-mono text-sm">/api/health</code> কী দেখাচ্ছে তা দেখে নিন।
      </p>
      {error.digest ? <code className="font-mono text-xs text-subtle">{error.digest}</code> : null}
      <button type="button" onClick={reset} className="btn self-start">
        আবার চেষ্টা করুন
      </button>
    </main>
  )
}
