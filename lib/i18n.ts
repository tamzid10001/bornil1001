import 'server-only'
import { cookies } from 'next/headers'

export type Lang = 'en' | 'bn'

export async function getLang(): Promise<Lang> {
  return (await cookies()).get('bornil_lang')?.value === 'bn' ? 'bn' : 'en'
}

export const NAV = [
  {
    group: { en: 'the thread', bn: 'অর্ডারের সুতো' },
    items: [
      { href: '/os', en: 'tonight', bn: 'আজ রাতে', icon: 'moon' },
      { href: '/os/inquiries', en: 'inquiries', bn: 'ইনকোয়ারি', icon: 'mail' },
      { href: '/os/costing', en: 'costing', bn: 'কস্টিং', icon: 'calculator' },
      { href: '/os/orders', en: 'orders', bn: 'অর্ডার', icon: 'package' },
    ],
  },
  {
    group: { en: 'the floor', bn: 'ফ্লোর' },
    items: [
      { href: '/os/floor', en: 'sewing lines', bn: 'সেলাই লাইন', icon: 'activity' },
      { href: '/os/quality', en: 'quality', bn: 'মান', icon: 'shield' },
      { href: '/os/maintenance', en: 'maintenance', bn: 'রক্ষণাবেক্ষণ', icon: 'wrench' },
    ],
  },
  {
    group: { en: 'the books', bn: 'হিসাব' },
    items: [
      { href: '/os/commercial', en: 'lc, btb & ud', bn: 'এলসি, বিটুবি ও ইউডি', icon: 'landmark' },
      { href: '/os/payroll', en: 'payroll', bn: 'বেতন', icon: 'wallet' },
      { href: '/os/approvals', en: 'gates & audit', bn: 'গেট ও অডিট', icon: 'stamp' },
    ],
  },
] as const
