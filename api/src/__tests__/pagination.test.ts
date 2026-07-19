import { describe, it, expect, vi } from 'vitest'
import { paginateWithCursor } from '../lib/pagination'

interface Row {
  id: string
}

describe('paginateWithCursor', () => {
  it('requests limit + 1 rows to detect hasMore', async () => {
    const fetchPage = vi.fn().mockResolvedValue([])
    await paginateWithCursor(fetchPage, { limit: 10 })

    expect(fetchPage).toHaveBeenCalledWith({ take: 11 })
  })

  it('passes cursor + skip: 1 when a cursor is given', async () => {
    const fetchPage = vi.fn().mockResolvedValue([])
    await paginateWithCursor(fetchPage, { cursor: 'row-5', limit: 10 })

    expect(fetchPage).toHaveBeenCalledWith({ cursor: { id: 'row-5' }, skip: 1, take: 11 })
  })

  it('reports hasMore: false and nextCursor: null on the last page', async () => {
    const rows: Row[] = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const fetchPage = vi.fn().mockResolvedValue(rows)

    const result = await paginateWithCursor(fetchPage, { limit: 10 })

    expect(result.data).toEqual(rows)
    expect(result.meta).toEqual({ nextCursor: null, hasMore: false })
  })

  it('reports hasMore: true, trims the lookahead row, and sets nextCursor to the last real row', async () => {
    // limit 3, but the fetcher returns 4 (limit + 1) — the extra one is the
    // lookahead used only to detect hasMore, and must not leak into data.
    const rows: Row[] = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
    const fetchPage = vi.fn().mockResolvedValue(rows)

    const result = await paginateWithCursor(fetchPage, { limit: 3 })

    expect(result.data).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }])
    expect(result.meta).toEqual({ nextCursor: '3', hasMore: true })
  })

  it('returns an empty page cleanly', async () => {
    const fetchPage = vi.fn().mockResolvedValue([])
    const result = await paginateWithCursor(fetchPage, { limit: 10 })

    expect(result.data).toEqual([])
    expect(result.meta).toEqual({ nextCursor: null, hasMore: false })
  })
})
