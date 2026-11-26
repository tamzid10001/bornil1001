import { getActor, grantsFor } from '@/lib/actor'
import { NoAccess, PageHeader } from '@/components/os/ui'
import { SettingsTabs } from '@/components/os/settings/tabs'

export const metadata = { title: 'সেটিংস' }

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const can = grantsFor(await getActor())
  if (!can['settings.manage'] && !can['staff.manage']) return <NoAccess title="সেটিংস" what="কারখানার সেটিংস" />

  const tabs = [
    can['settings.manage'] && { href: '/os/settings', label: 'কারখানা ও ব্র্যান্ড' },
    { href: '/os/settings/people', label: 'ভূমিকা ও কর্মী' },
    can['settings.manage'] && { href: '/os/settings/floor', label: 'ফ্লোর প্ল্যান' },
    can['settings.manage'] && { href: '/os/settings/production', label: 'পোশাক ও উৎপাদন' },
    can['settings.manage'] && { href: '/os/settings/tna', label: 'ক্রিটিক্যাল পাথ' },
    can['settings.manage'] && { href: '/os/settings/quality', label: 'মান নিয়ন্ত্রণ' },
    can['settings.manage'] && { href: '/os/settings/workflow', label: 'গেট, মডিউল ও নম্বর' },
    can['settings.manage'] && { href: '/os/settings/payroll', label: 'বেতন কাঠামো' },
  ].filter(Boolean) as { href: string; label: string }[]

  return (
    <>
      <PageHeader eyebrow="প্রশাসন" title="সেটিংস" lede="আপনার কারখানার নাম, ব্র্যান্ড, মানুষ, ফ্লোর আর কাজের নিয়ম — সব এখান থেকে সাজান। প্রতিটি পরিবর্তন অডিট ট্রেইলে থাকে।" divider={false} />
      <SettingsTabs tabs={tabs} />
      <div className="flex flex-col gap-10">{children}</div>
    </>
  )
}
