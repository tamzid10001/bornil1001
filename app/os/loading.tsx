export default function OsLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">লোড হচ্ছে…</span>
      <div className="flex flex-col gap-3">
        <span className="h-3 w-32 animate-pulse rounded bg-key" />
        <span className="h-9 w-72 max-w-full animate-pulse rounded bg-key" />
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-16 animate-pulse rounded-lg bg-key" />
        ))}
      </div>
      <span className="h-64 animate-pulse rounded-xl bg-key" />
    </div>
  )
}
