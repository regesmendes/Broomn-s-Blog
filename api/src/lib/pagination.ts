/**
 * Cursor-based pagination. Fetches limit + 1 rows to determine hasMore without
 * a separate count() — the trick that makes this stable as tables grow, since
 * a plain OFFSET/skip-based page N still has to walk past N rows every time.
 *
 * Callers must order by a field list that ends in a unique tiebreaker (e.g.
 * `[{ createdAt: 'desc' }, { id: 'desc' }]`), so ties on the primary sort field
 * never cause a row to be skipped or repeated across pages.
 */

export interface CursorPageResult<T> {
  data: T[]
  meta: {
    nextCursor: string | null
    hasMore: boolean
  }
}

export interface CursorFetchArgs {
  cursor?: { id: string }
  skip?: number
  take: number
}

export async function paginateWithCursor<T extends { id: string }>(
  fetchPage: (args: CursorFetchArgs) => Promise<T[]>,
  { cursor, limit }: { cursor?: string; limit: number }
): Promise<CursorPageResult<T>> {
  const rows = await fetchPage({
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
  })

  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows

  return {
    data,
    meta: {
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore,
    },
  }
}
