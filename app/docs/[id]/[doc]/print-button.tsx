'use client'

export function PrintButton() {
  return (
    <div className="flex justify-end print:hidden">
      <button type="button" onClick={() => window.print()} className="btn btn-sm">
        প্রিন্ট বা পিডিএফ
      </button>
    </div>
  )
}
