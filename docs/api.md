# API Reference

See the root [README](../README.md) for setup and the [architecture doc](./architecture.md) for the reasoning behind these endpoints (pagination, auth flow, data model, etc).

## Public

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/posts` | List published posts (paginated, filterable by tag, text search — search matches both PT and EN title/excerpt/content) |
| GET | `/posts/:slug` | Get a single published post — includes `titleEn`/`excerptEn`/`contentEn` (`null` if not yet translated) |
| GET | `/posts/:postId/comments` | List approved comments for a post |
| GET | `/tags` | List all tags with post count |
| POST | `/newsletter/subscribe` | Subscribe to newsletter |
| GET | `/newsletter/confirm?token=` | Confirm subscription |
| GET | `/newsletter/unsubscribe?token=` | Unsubscribe |
| GET | `/about` | Get the About page content — includes `contentEn` (`null` if not yet translated) |
| GET | `/support` | Get the Support ("Say Thanks") page content — includes `contentEn` (`null` if not yet translated) |

## Authenticated (any logged-in user)

| Method | Path | Description |
|---|---|---|
| POST | `/auth/google` | Exchange Cognito ID token for app JWT |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user profile |
| POST | `/posts/:postId/comments` | Create a comment (pending approval) |
| DELETE | `/comments/:id` | Delete own comment |
| POST | `/analytics/pageview` | Record a page view (fired by the frontend tracker; `userId` always from the token, 60/min rate limit) |

## Admin only

| Method | Path | Description |
|---|---|---|
| POST | `/posts` | Create a post — accepts `titleEn`/`excerptEn`/`contentEn` alongside the PT fields. `400` if `status: PUBLISHED` is set without both `titleEn` and `contentEn` non-blank |
| PUT | `/posts/:id` | Update a post — same `*En` fields. `400` only when this update is the `DRAFT → PUBLISHED` transition and `titleEn`/`contentEn` end up blank; a already-published post can otherwise be saved (e.g. by autosave) without either being filled |
| DELETE | `/posts/:id` | Delete a post |
| PATCH | `/posts/:id/publish` | Publish/unpublish/schedule a post — same `400` gating as above on the `DRAFT → PUBLISHED` transition |
| GET | `/posts/admin` | List all posts regardless of status (drafts included), optionally filtered by `status` |
| GET | `/posts/admin/:id` | Get any post (including drafts) |
| GET | `/posts/:postId/comments/all` | List all comments for one post (including unapproved) |
| GET | `/comments/admin` | List all comments across every post, filterable by approval status |
| POST | `/comments/:id/reply` | Reply to a top-level comment as "Broomn" — auto-approved, notifies the original commenter by email |
| PATCH | `/comments/:id/approve` | Approve/reject a comment |
| GET | `/newsletter/subscribers` | List all subscribers, optionally filtered by `status` and/or a case-insensitive `email` search |
| POST | `/newsletter/subscribers/:id/unsubscribe` | Manually unsubscribe an address on the admin's behalf |
| PATCH | `/newsletter/subscribers/:id/block` | Block an address — stops delivery, prevents re-subscribing |
| PATCH | `/newsletter/subscribers/:id/unblock` | Unblock an address |
| POST | `/newsletter/send` | Send newsletter to confirmed subscribers |
| POST | `/media/upload` | Upload an image (multipart, 5MB max) |
| GET | `/media` | List all media with usage count |
| GET | `/media/:id` | Get media details with posts (and whether the About/Support pages) uses it |
| DELETE | `/media/:id` | Delete a media file |
| PATCH | `/media/:id/replace` | Replace image URL across all posts (both `content` and `contentEn`), the About page, and the Support page |
| GET | `/tags/admin?cursor=&limit=&search=` | Paginated tag listing for the admin tag management page, optionally filtered by a case-insensitive `search` on name |
| PATCH | `/tags/:id` | Rename a tag. If the new name's slug collides with a *different* existing tag, merges into it instead — reassigns this tag's posts onto the existing one (deduping any post that already had both) and deletes this tag |
| DELETE | `/tags/:id` | Delete a tag. Allowed even if posts still use it — the join-table rows cascade, posts simply lose the tag |
| PUT | `/about` | Update the About page content — accepts an optional `contentEn`. No gating (unlike posts): About has no draft state, so `contentEn` is never required and a blank one is just persisted as `null` |
| PUT | `/support` | Update the Support page content — same `contentEn` handling as About |
| GET | `/analytics/summary?from=&to=` | Grouped counts for a period (defaults to last 30 days) — users, posts (new/reads/comments), newsletter (subscribed/unsubscribed/blocked/pending all-time, plus subscribedInPeriod/unsubscribedInPeriod), backend (API requests) |
| GET | `/analytics/requests/by-user?from=&to=&limit=&offset=&search=` | Requests per user in a period, busiest first, paginated (`limit` 1–200 default 50, `offset` default 0) and optionally filtered by name/email (`search`); response includes `meta: { offset, limit, total, hasMore }` |
| GET | `/analytics/users/:userId/sessions?from=&to=&limit=` | One user's browsing sessions (capped list, limit 1–100, default 20); 404 if user unknown |
| GET | `/analytics/users/:userId/sessions/:sessionId` | Full journey of one session — page views and logged actions interleaved, in visit order |
