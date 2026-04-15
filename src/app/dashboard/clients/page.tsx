// 客户列表页
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

async function getClients() {
  const { data } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

export default async function ClientsPage() {
  const clients = await getClients()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">客户管理</h1>
        <Link
          href="/dashboard/clients/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          + 添加客户
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          还没有客户，点击上方按钮添加第一个客户
        </div>
      ) : (
        <div className="grid gap-4">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-sm transition-all block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{client.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{client.domain}</p>
                  {client.industry && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      {client.industry}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <StatusBadge status={client.status} />
                  <div className="text-gray-400">
                    {client.publish_per_week} 篇/周
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    archived: 'bg-gray-100 text-gray-500',
  }
  const labels: Record<string, string> = {
    active: '运行中',
    paused: '已暂停',
    archived: '已归档',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${styles[status] || styles.archived}`}>
      {labels[status] || status}
    </span>
  )
}
