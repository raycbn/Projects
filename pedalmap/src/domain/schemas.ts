import { z } from 'zod'

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const bikeTypeSchema = z.enum(['road', 'mtb', 'gravel', 'urban', 'ebike'])

export const routeTypeSchema = z.enum(['a_to_b', 'circular', 'out_and_back'])

export const routePreferenceSchema = z.enum([
  'prefer_bike_lanes',
  'prefer_secondary_roads',
  'avoid_primary_roads',
  'avoid_traffic',
  'avoid_unpaved',
  'prefer_unpaved',
  'prefer_less_elevation',
  'prefer_shorter',
  'prefer_faster',
])

export const waypointSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  position: latLngSchema,
  order: z.number().int().nonnegative(),
  kind: z.enum(['start', 'via', 'end']),
})

export const routingRequestSchema = z
  .object({
    waypoints: z.array(latLngSchema).min(1).max(20),
    bikeType: bikeTypeSchema,
    preferences: z.array(routePreferenceSchema),
    routeType: routeTypeSchema,
    language: z.string().optional(),
    circularDistanceMeters: z.number().positive().max(200_000).optional(),
    targetElevationGainMeters: z.number().nonnegative().max(10_000).optional(),
    circularSeed: z.number().int().nonnegative().max(10_000).optional(),
    wantAlternatives: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.routeType === 'circular') {
      if (value.waypoints.length < 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Circular routes require at least a start point',
          path: ['waypoints'],
        })
      }
      if (!value.circularDistanceMeters) {
        ctx.addIssue({
          code: 'custom',
          message: 'Circular routes require a target distance',
          path: ['circularDistanceMeters'],
        })
      }
    } else if (value.waypoints.length < 2) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least two waypoints are required',
        path: ['waypoints'],
      })
    }
  })

export const saveRouteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  isPublic: z.boolean().default(false),
})

export type SaveRouteInput = z.infer<typeof saveRouteSchema>
