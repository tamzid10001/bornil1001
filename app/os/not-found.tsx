import Link from 'next/link'

export default function OsNotFound() {
  return (
    <div className="flex flex-col gap-4 py-10">
      <p className="label">৪০৪</p>
      <h1 className="text-3xl leading-tight">এই পাতাটি পাওয়া যায়নি</h1>
      <p className="max-w-xl leading-relaxed text-muted">অর্ডার, কোটেশন বা ইনকোয়ারিটি হয়তো মুছে ফেলা হয়েছে, অথবা লিংকটি ভুল।</p>
      <Link href="/os" className="btn self-start">
        আজ রাতের সারাংশে ফিরুন
      </Link>
    </div>
  )
}
