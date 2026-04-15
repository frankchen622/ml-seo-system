// 客户设置页（Client Component）
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface ClientData {
  id: string
  name: string
  domain: string
  wp_url: string
  wp_username: string
  wp_app_password: string
  gsc_site_url: string
  google_refresh_token: string
  google_client_id: string
  google_client_secret: string
  ga4_property_id: string
  industry: string
  target_audience: string
  brand_voice: string
  publish_per_week: number
  ai_model: string
  auto_publish: boolean
  status: string
}

export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [client, setClient] = useState<ClientData | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch(`/api/clients/${id}`).then(r => r.json()).then(d => setClient(d.client))
  }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!client) return
    setSaving(true)
    setMsg('')
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client),
    })
    setSaving(false)
    if (res.ok) setMsg('保存成功')
    else setMsg('保存失败')
  }

  if (!client) return <div className="p-8 text-gray-500">加载中...</div>

  return (
    <div>
      <Link href={`/dashboard/clients/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← 返回</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-6">客户设置</h1>

      <form onSubmit={handleSave} className="max-w-2xl space-y-6">
        <Section title="基本信息">
          <Field label="客户名称" value={client.name} onChange={v => setClient({ ...client, name: v })} />
          <Field label="域名" value={client.domain} onChange={v => setClient({ ...client, domain: v })} />
          <Field label="行业" value={client.industry || ''} onChange={v => setClient({ ...client, industry: v })} />
          <Field label="目标受众" value={client.target_audience || ''} onChange={v => setClient({ ...client, target_audience: v })} />
          <Field label="品牌调性" value={client.brand_voice || ''} onChange={v => setClient({ ...client, brand_voice: v })} />
        </Section>

        <Section title="WordPress 配置">
          <Field label="WP 站点 URL" value={client.wp_url} onChange={v => setClient({ ...client, wp_url: v })} />
          <Field label="WP 用户名" value={client.wp_username || ''} onChange={v => setClient({ ...client, wp_username: v })} />
          <Field label="WP 应用密码" value={client.wp_app_password || ''} onChange={v => setClient({ ...client, wp_app_password: v })} type="password" />
        </Section>

        <Section title="Google API 配置">
          <Field label="GSC 站点 URL" value={client.gsc_site_url || ''} onChange={v => setClient({ ...client, gsc_site_url: v })} />
          <Field label="GA4 Property ID" value={client.ga4_property_id || ''} onChange={v => setClient({ ...client, ga4_property_id: v })} />
          <Field label="Google Client ID" value={client.google_client_id || ''} onChange={v => setClient({ ...client, google_client_id: v })} />
          <Field label="Google Client Secret" value={client.google_client_secret || ''} onChange={v => setClient({ ...client, google_client_secret: v })} type="password" />
          <Field label="Google Refresh Token" value={client.google_refresh_token || ''} onChange={v => setClient({ ...client, google_refresh_token: v })} type="password" />
        </Section>

        <Section title="发布策略">
          <div className="grid grid-cols-2 gap-4">
            <Field label="每周发布量" value={String(client.publish_per_week)} onChange={v => setClient({ ...client, publish_per_week: parseInt(v) || 10 })} />
            <Field label="AI 模型" value={client.ai_model} onChange={v => setClient({ ...client, ai_model: v })} />
          </div>
          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={client.auto_publish} onChange={e => setClient({ ...client, auto_publish: e.target.checked })} className="rounded" />
            <span className="text-sm text-gray-700">自动发布（跳过人工审核）</span>
          </label>
        </Section>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
            {saving ? '保存中...' : '保存设置'}
          </button>
          {msg && <span className="text-sm text-green-600">{msg}</span>}
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  )
}
