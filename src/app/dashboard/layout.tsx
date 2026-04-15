// Dashboard 布局
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 侧边栏 */}
      <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col gap-2">
        <Link href="/dashboard" className="text-xl font-bold text-gray-900 mb-6 block">
          ML-SEO
        </Link>
        <nav className="flex flex-col gap-1">
          <NavLink href="/dashboard">📊 总览</NavLink>
          <NavLink href="/dashboard/clients">👥 客户管理</NavLink>
          <NavLink href="/dashboard/content/review">📝 内容审核</NavLink>
          <NavLink href="/dashboard/system/settings">⚙️ 系统设置</NavLink>
        </nav>
      </aside>
      {/* 主内容 */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors text-sm"
    >
      {children}
    </Link>
  )
}
