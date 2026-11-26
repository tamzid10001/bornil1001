import Link from 'next/link'

export default function OsNotFound() {
  return (
    <div className="flex flex-col gap-4 py-10">
      <p className="label">৪০৪</p>
      <h1 className="text-3xl leading-tight">এই পাতাটি পাওয়া যায়নি</h1>
      <Link href="/os" className="btn self-start">
        সারাংশে ফিরুন
      </Link>
    </div>
  )
}
