import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ElevationPoint, LatLng } from '@/domain/types'

interface ElevationChartProps {
  profile: ElevationPoint[]
  onHover?: (point: LatLng | null, distanceMeters?: number) => void
}

export function ElevationChart({ profile, onHover }: ElevationChartProps) {
  if (!profile.length) {
    return (
      <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-[var(--color-fog)] bg-[var(--color-mist)]/40 px-4 text-center text-sm font-medium text-[var(--color-stone)]">
        Sin datos de elevación para esta ruta. Puedes recalcular o probar otra zona.
      </div>
    )
  }

  const data = profile.map((p) => ({
    km: Number((p.distanceMeters / 1000).toFixed(2)),
    elev: Math.round(p.elevationMeters),
    lat: p.position?.lat,
    lng: p.position?.lng,
    distanceMeters: p.distanceMeters,
  }))

  return (
    <div className="h-48 w-full rounded-2xl bg-white p-2 ring-1 ring-[var(--color-fog)] md:h-56 md:p-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          onMouseMove={(state) => {
            const raw = state as {
              activePayload?: Array<{
                payload?: { lat?: number; lng?: number; distanceMeters?: number }
              }>
            }
            const payload = raw.activePayload?.[0]?.payload
            if (payload?.lat !== undefined && payload?.lng !== undefined) {
              onHover?.(
                { lat: payload.lat, lng: payload.lng },
                payload.distanceMeters,
              )
            }
          }}
          onMouseLeave={() => onHover?.(null)}
        >
          <defs>
            <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#167a52" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#167a52" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#d9e7df" />
          <XAxis
            dataKey="km"
            tickFormatter={(v) => `${v}`}
            stroke="#5b6d64"
            fontSize={11}
            label={{ value: 'km', position: 'insideBottomRight', offset: -4 }}
          />
          <YAxis
            dataKey="elev"
            stroke="#5b6d64"
            fontSize={11}
            width={42}
            label={{ value: 'm', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value) => [`${value} m`, 'Altitud']}
            labelFormatter={(label) => `Km ${label}`}
            contentStyle={{
              borderRadius: 12,
              borderColor: '#d9e7df',
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="elev"
            stroke="#0d3b2b"
            strokeWidth={2}
            fill="url(#elevFill)"
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
