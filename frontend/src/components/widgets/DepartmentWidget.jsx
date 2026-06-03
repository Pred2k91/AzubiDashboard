import { useState, useEffect } from 'react'
import { Building2, Users, MapPin } from 'lucide-react'
import { azubisApi } from '../../api/client'

export default function DepartmentWidget() {
  const [data, setData] = useState({ departments: [], unassigned: [] })

  const load = () => azubisApi.getByDepartment().then(setData).catch(() => {})

  useEffect(() => {
    load()
    const interval = setInterval(load, 120000)
    return () => clearInterval(interval)
  }, [])

  const active = data.departments.filter(d => d.azubis.length > 0)

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-indigo-400" />
          <span className="widget-title">Abteilungsübersicht</span>
        </div>
        <span className="text-xs text-slate-600 bg-[#1e2035] px-2 py-0.5 rounded-full flex items-center gap-1">
          <Users size={10} />
          {data.departments.reduce((s, d) => s + d.azubis.length, 0) + data.unassigned.length}
        </span>
      </div>
      <div className="widget-body">
        {active.length === 0 && data.unassigned.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-600">
            <Building2 size={24} className="mb-2 opacity-30" />
            <span className="text-sm">Keine Azubis eingepflegt</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {active.map(dept => (
              <div
                key={dept.id}
                className="p-3 rounded-xl border bg-[#1e2035]/50 transition-all hover:bg-[#1e2035]"
                style={{ borderColor: `${dept.color}40` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
                  <span className="text-xs font-bold text-white truncate">{dept.name}</span>
                  <span
                    className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: `${dept.color}20`, color: dept.color }}
                  >
                    {dept.azubis.length}
                  </span>
                </div>
                {dept.location && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-600 mb-2">
                    <MapPin size={9} />
                    {dept.location}
                  </div>
                )}
                <div className="space-y-1">
                  {dept.azubis.map(a => (
                    <div key={a.id} className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                        style={{ backgroundColor: `${dept.color}25`, color: dept.color }}
                      >
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-300 truncate">{a.name}</span>
                      <span className="ml-auto text-[9px] text-slate-600 shrink-0">{a.lehrjahr}. Lj.</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {data.unassigned.length > 0 && (
              <div className="p-3 rounded-xl border border-[#2a2d4a] bg-[#1e2035]/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-500">Nicht zugewiesen</span>
                  <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 shrink-0">
                    {data.unassigned.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {data.unassigned.map(a => (
                    <div key={a.id} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-slate-700 text-slate-400 shrink-0">
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-500 truncate">{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
