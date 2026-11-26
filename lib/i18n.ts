import 'server-only'
import type { ModuleKey, Permission } from './config'

export type Lang = 'en' | 'bn'

export async function getLang(): Promise<Lang> {
  return 'bn'
}

type NavItem = { href: string; label: string; icon: string; module?: ModuleKey; permission?: Permission[] }

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'অর্ডার প্রবাহ',
    items: [
      { href: '/os', label: 'আজ রাতের সারাংশ', icon: 'moon' },
      { href: '/os/inquiries', label: 'ইনকোয়ারি', icon: 'mail', module: 'inquiries' },
      { href: '/os/costing', label: 'কস্টিং', icon: 'calculator', module: 'costing' },
      { href: '/os/orders', label: 'অর্ডার', icon: 'package' },
    ],
  },
  {
    group: 'উৎপাদন',
    items: [
      { href: '/os/floor', label: 'উৎপাদন ফ্লোর', icon: 'activity' },
      { href: '/os/quality', label: 'মান নিয়ন্ত্রণ', icon: 'shield' },
      { href: '/os/maintenance', label: 'রক্ষণাবেক্ষণ', icon: 'wrench', module: 'maintenance' },
    ],
  },
  {
    group: 'হিসাব',
    items: [
      { href: '/os/commercial', label: 'এলসি, বিটুবি ও ইউডি', icon: 'landmark', module: 'commercial' },
      { href: '/os/payroll', label: 'বেতন', icon: 'wallet', module: 'payroll', permission: ['payroll.view', 'payroll.manage'] },
      { href: '/os/approvals', label: 'গেট ও অডিট', icon: 'stamp' },
    ],
  },
  {
    group: 'প্রশাসন',
    items: [{ href: '/os/settings', label: 'সেটিংস', icon: 'settings', permission: ['settings.manage', 'staff.manage'] }],
  },
]
