import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanDriverName, frotcomGet, syncFrotcomMileage, lookupVehicleAt } from '@/lib/frotcom'
import { prisma } from '@/lib/prisma'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    settings: { findUnique: vi.fn(), update: vi.fn() },
    truck:    { findMany: vi.fn(), update: vi.fn() },
  },
}))

const mockSettings = vi.mocked(prisma.settings)
const mockTruck    = vi.mocked(prisma.truck)

function mockResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: { get: (k: string) => headers[k] ?? null },
  }
}

// Settings row with a stored token — no reauth needed
const settingsWithToken = {
  id: 1,
  frotcomToken: 'stored-token',
  frotcomUsername: 'user',
  frotcomPassword: 'pass',
}

// Settings row without a stored token — reauth required
const settingsNoToken = {
  id: 1,
  frotcomToken: null,
  frotcomUsername: 'user',
  frotcomPassword: 'pass',
}

afterEach(() => {
  vi.resetAllMocks()
})

// ─── cleanDriverName ──────────────────────────────────────────────────────────

describe('cleanDriverName', () => {
  it('returns the name as-is for clean input', () => {
    expect(cleanDriverName('Ivan Petrov')).toBe('Ivan Petrov')
    expect(cleanDriverName('Georgi Ivanov')).toBe('Georgi Ivanov')
  })

  it('strips leading asterisks', () => {
    expect(cleanDriverName('*John Doe')).toBe('John Doe')
    expect(cleanDriverName('**Jane Smith')).toBe('Jane Smith')
    expect(cleanDriverName('***Triple Star')).toBe('Triple Star')
  })

  it('strips asterisks and then trims whitespace', () => {
    expect(cleanDriverName('*  Spaced Name  ')).toBe('Spaced Name')
  })

  it('returns null for names starting with a digit (junk card entries)', () => {
    expect(cleanDriverName('123abc')).toBeNull()
    expect(cleanDriverName('0 Driver')).toBeNull()
    expect(cleanDriverName('*9SomeJunk')).toBeNull()
  })

  it('returns null for names containing "created by" (case-insensitive)', () => {
    expect(cleanDriverName('Created by App')).toBeNull()
    expect(cleanDriverName('CREATED BY SYSTEM')).toBeNull()
    expect(cleanDriverName('auto created by driver')).toBeNull()
  })

  it('returns null for empty string after stripping asterisks', () => {
    expect(cleanDriverName('')).toBeNull()
    expect(cleanDriverName('***')).toBeNull()
    expect(cleanDriverName('*   ')).toBeNull()
  })

  it('preserves names that contain digits but do not start with one', () => {
    expect(cleanDriverName('Driver 007')).toBe('Driver 007')
    expect(cleanDriverName('Ivan2')).toBe('Ivan2')
  })
})

// ─── frotcomGet ───────────────────────────────────────────────────────────────

describe('frotcomGet', () => {
  beforeEach(() => {
    mockSettings.findUnique.mockResolvedValue(settingsWithToken as never)
    mockSettings.update.mockResolvedValue(settingsWithToken as never)
  })

  it('returns parsed JSON on a successful 200 response', async () => {
    const payload = [{ id: '1', licensePlate: 'AB-12-CD' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, payload)))

    const result = await frotcomGet<typeof payload>('/vehicles')
    expect(result).toEqual(payload)
  })

  it('uses the stored token without triggering reauth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await frotcomGet('/vehicles')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('api_key=stored-token')
    expect(mockSettings.update).not.toHaveBeenCalled()
  })

  it('appends ?api_key= when path has no query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await frotcomGet('/vehicles')

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/vehicles\?api_key=/)
  })

  it('appends &api_key= when path already contains a query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await frotcomGet('/vehicles?filter=active')

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/vehicles\?filter=active&api_key=/)
  })

  it('re-auths and retries on 401, succeeding on the second attempt', async () => {
    // getToken reads settings (has stored token), 401 fires reauth which reads again
    mockSettings.findUnique
      .mockResolvedValueOnce(settingsWithToken as never) // getToken
      .mockResolvedValueOnce(settingsNoToken as never)   // reauth reads settings

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResponse(401, {}))                     // initial request → 401
      .mockResolvedValueOnce(mockResponse(200, { token: 'new-token' })) // POST /authorize
      .mockResolvedValueOnce(mockResponse(200, { id: 1 }))              // retry succeeds
    vi.stubGlobal('fetch', fetchMock)

    const result = await frotcomGet<{ id: number }>('/vehicles/1')
    expect(result).toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws after 401 retry also fails', async () => {
    mockSettings.findUnique.mockResolvedValue(settingsWithToken as never)

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResponse(401, {}))                     // initial → 401
      .mockResolvedValueOnce(mockResponse(200, { token: 'new-token' })) // reauth
      .mockResolvedValueOnce(mockResponse(401, {}))                     // retry → 401 again
    vi.stubGlobal('fetch', fetchMock)

    await expect(frotcomGet('/vehicles')).rejects.toThrow('failed: 401')
  })

  it('throws "endpoint limit" error with reset time on 429 when endpoint is exhausted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(429, { message: 'Rate limit exceeded', statusCode: 429 }, {
        'X-Endpoint-RateLimit-Remaining': '0',
        'X-Endpoint-RateLimit-Reset': '1678886460',
        'X-RateLimit-Remaining': '5000',
        'X-RateLimit-Reset': '1678886460',
      })
    ))

    await expect(frotcomGet('/vehicles')).rejects.toThrow(
      /rate limit exceeded \(endpoint limit\).*Resets at/i
    )
  })

  it('throws "company limit" error with reset time on 429 when company limit is exhausted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(429, { message: 'Rate limit exceeded', statusCode: 429 }, {
        'X-Endpoint-RateLimit-Remaining': '50',
        'X-Endpoint-RateLimit-Reset': '1678886460',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '1678886460',
      })
    ))

    await expect(frotcomGet('/vehicles')).rejects.toThrow(
      /rate limit exceeded \(company limit\).*Resets at/i
    )
  })

  it('includes "unknown" in the error when the reset header is absent on 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(429, {}, {
        'X-Endpoint-RateLimit-Remaining': '0',
        // no reset header provided
      })
    ))

    await expect(frotcomGet('/vehicles')).rejects.toThrow(/Resets at unknown/)
  })

  it('throws a generic error on 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(500, {})))

    await expect(frotcomGet('/vehicles')).rejects.toThrow('Frotcom GET /vehicles failed: 500')
  })
})

// ─── syncFrotcomMileage ───────────────────────────────────────────────────────

describe('syncFrotcomMileage', () => {
  beforeEach(() => {
    mockSettings.findUnique.mockResolvedValue(settingsWithToken as never)
    mockSettings.update.mockResolvedValue(settingsWithToken as never)
    mockTruck.update.mockResolvedValue({} as never)
  })

  it('returns { updated: 0, errors: [] } immediately when no Frotcom-linked active trucks', async () => {
    mockTruck.findMany.mockResolvedValue([])

    const result = await syncFrotcomMileage()
    expect(result).toEqual({ updated: 0, errors: [] })
  })

  it('throws when Frotcom response is not an array', async () => {
    mockTruck.findMany.mockResolvedValue([
      { id: 'truck-1', frotcomVehicleId: '101', useCanbusMileage: true },
    ] as never)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, { data: [{ id: '101' }] }) // wrapped object — wrong shape
    ))

    await expect(syncFrotcomMileage()).rejects.toThrow('unexpected shape')
  })

  it('uses odometerCanbus when useCanbusMileage is true', async () => {
    mockTruck.findMany.mockResolvedValue([
      { id: 'truck-1', frotcomVehicleId: '101', useCanbusMileage: true },
    ] as never)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, [{ id: '101', odometerCanbus: 150000, odometerGps: 149000 }])
    ))

    await syncFrotcomMileage()

    expect(mockTruck.update).toHaveBeenCalledWith({
      where: { id: 'truck-1' },
      data:  { currentMileage: 150000 },
    })
  })

  it('uses odometerGps when useCanbusMileage is false', async () => {
    mockTruck.findMany.mockResolvedValue([
      { id: 'truck-1', frotcomVehicleId: '101', useCanbusMileage: false },
    ] as never)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, [{ id: '101', odometerCanbus: 150000, odometerGps: 149000 }])
    ))

    await syncFrotcomMileage()

    expect(mockTruck.update).toHaveBeenCalledWith({
      where: { id: 'truck-1' },
      data:  { currentMileage: 149000 },
    })
  })

  it('falls back to odometerGps when canbus is null and useCanbusMileage is true', async () => {
    mockTruck.findMany.mockResolvedValue([
      { id: 'truck-1', frotcomVehicleId: '101', useCanbusMileage: true },
    ] as never)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, [{ id: '101', odometerCanbus: null, odometerGps: 149000 }])
    ))

    await syncFrotcomMileage()

    expect(mockTruck.update).toHaveBeenCalledWith({
      where: { id: 'truck-1' },
      data:  { currentMileage: 149000 },
    })
  })

  it('falls back to odometerCanbus when gps is null and useCanbusMileage is false', async () => {
    mockTruck.findMany.mockResolvedValue([
      { id: 'truck-1', frotcomVehicleId: '101', useCanbusMileage: false },
    ] as never)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, [{ id: '101', odometerCanbus: 150000, odometerGps: null }])
    ))

    await syncFrotcomMileage()

    expect(mockTruck.update).toHaveBeenCalledWith({
      where: { id: 'truck-1' },
      data:  { currentMileage: 150000 },
    })
  })

  it('adds an error and skips update when truck vehicleId is not in Frotcom response', async () => {
    mockTruck.findMany.mockResolvedValue([
      { id: 'truck-1', frotcomVehicleId: '999', useCanbusMileage: true },
    ] as never)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, [{ id: '101', odometerCanbus: 150000, odometerGps: 149000 }])
    ))

    const result = await syncFrotcomMileage()

    expect(result.updated).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('999')
    expect(mockTruck.update).not.toHaveBeenCalled()
  })

  it('adds an error and skips update when both odometer values are null', async () => {
    mockTruck.findMany.mockResolvedValue([
      { id: 'truck-1', frotcomVehicleId: '101', useCanbusMileage: true },
    ] as never)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, [{ id: '101', odometerCanbus: null, odometerGps: null }])
    ))

    const result = await syncFrotcomMileage()

    expect(result.updated).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('No mileage data')
    expect(mockTruck.update).not.toHaveBeenCalled()
  })

  it('handles numeric Frotcom vehicle IDs via string coercion', async () => {
    mockTruck.findMany.mockResolvedValue([
      { id: 'truck-1', frotcomVehicleId: '101', useCanbusMileage: true }, // stored as string
    ] as never)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, [{ id: 101, odometerCanbus: 155000, odometerGps: null }]) // returned as number
    ))

    const result = await syncFrotcomMileage()

    expect(result.updated).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(mockTruck.update).toHaveBeenCalledWith({
      where: { id: 'truck-1' },
      data:  { currentMileage: 155000 },
    })
  })
})

// ─── lookupVehicleAt ─────────────────────────────────────────────────────────

describe('lookupVehicleAt', () => {
  beforeEach(() => {
    mockSettings.findUnique.mockResolvedValue(settingsWithToken as never)
    mockSettings.update.mockResolvedValue(settingsWithToken as never)
  })

  it('returns the location closest to the requested timestamp', async () => {
    const at = new Date('2026-03-17T10:00:00Z')
    const locations = [
      { timeStamp: '2026-03-17T09:30:00Z', driverName: 'Far', driverId: 1, odometerCanbus: 100000, odometerGps: 99000 },
      { timeStamp: '2026-03-17T09:58:00Z', driverName: 'Closest', driverId: 2, odometerCanbus: 110000, odometerGps: 109000 },
      { timeStamp: '2026-03-17T10:15:00Z', driverName: 'Medium', driverId: 3, odometerCanbus: 120000, odometerGps: 119000 },
    ]

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, locations)))

    const result = await lookupVehicleAt('v1', at, true)

    expect(result.driverName).toBe('Closest')
    expect(result.driverId).toBe('2')
    expect(result.mileage).toBe(110000)
  })

  it('uses odometerCanbus when useCanbusMileage is true', async () => {
    const at = new Date('2026-03-17T10:00:00Z')
    const locations = [
      { timeStamp: '2026-03-17T10:00:00Z', driverName: 'Ivan', driverId: 42, odometerCanbus: 150000, odometerGps: 149000 },
    ]

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, locations)))

    const result = await lookupVehicleAt('v1', at, true)

    expect(result.mileage).toBe(150000)
  })

  it('uses odometerGps when useCanbusMileage is false', async () => {
    const at = new Date('2026-03-17T10:00:00Z')
    const locations = [
      { timeStamp: '2026-03-17T10:00:00Z', driverName: 'Ivan', driverId: 42, odometerCanbus: 150000, odometerGps: 149000 },
    ]

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, locations)))

    const result = await lookupVehicleAt('v1', at, false)

    expect(result.mileage).toBe(149000)
  })

  it('falls back to odometerGps when canbus is null and useCanbusMileage is true', async () => {
    const at = new Date('2026-03-17T10:00:00Z')
    const locations = [
      { timeStamp: '2026-03-17T10:00:00Z', driverName: 'Ivan', driverId: 42, odometerCanbus: null, odometerGps: 149000 },
    ]

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, locations)))

    const result = await lookupVehicleAt('v1', at, true)

    expect(result.mileage).toBe(149000)
  })

  it('falls back to odometerCanbus when gps is null and useCanbusMileage is false', async () => {
    const at = new Date('2026-03-17T10:00:00Z')
    const locations = [
      { timeStamp: '2026-03-17T10:00:00Z', driverName: 'Ivan', driverId: 42, odometerCanbus: 150000, odometerGps: null },
    ]

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, locations)))

    const result = await lookupVehicleAt('v1', at, false)

    expect(result.mileage).toBe(150000)
  })

  it('returns all nulls when locations array is empty', async () => {
    const at = new Date('2026-03-17T10:00:00Z')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, [])))

    const result = await lookupVehicleAt('v1', at, true)

    expect(result).toEqual({ driverName: null, driverId: null, mileage: null })
  })

  it('returns all nulls when response is not an array', async () => {
    const at = new Date('2026-03-17T10:00:00Z')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { data: [] })))

    const result = await lookupVehicleAt('v1', at, true)

    expect(result).toEqual({ driverName: null, driverId: null, mileage: null })
  })

  it('cleans driver name by stripping leading asterisks', async () => {
    const at = new Date('2026-03-17T10:00:00Z')
    const locations = [
      { timeStamp: '2026-03-17T10:00:00Z', driverName: '*Ivan Petrov', driverId: 42, odometerCanbus: 150000, odometerGps: 149000 },
    ]

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, locations)))

    const result = await lookupVehicleAt('v1', at, true)

    expect(result.driverName).toBe('Ivan Petrov')
  })

  it('converts numeric driverId to string', async () => {
    const at = new Date('2026-03-17T10:00:00Z')
    const locations = [
      { timeStamp: '2026-03-17T10:00:00Z', driverName: 'Ivan', driverId: 42, odometerCanbus: 150000, odometerGps: 149000 },
    ]

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, locations)))

    const result = await lookupVehicleAt('v1', at, true)

    expect(result.driverId).toBe('42')
    expect(typeof result.driverId).toBe('string')
  })
})
