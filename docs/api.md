# API Reference

See the root [README](../README.md) for setup and the [architecture doc](./architecture.md) for the reasoning behind these endpoints (pagination, auth flow, data model, etc).

## Public

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/posts` | List published posts (paginated, filterable by tag, text search) |
| GET | `/posts/:slug` | Get a single published post |
| GET | `/posts/:postId/comments` | List approved comments for a post |
| GET | `/tags` | List all tags with post count |
| POST | `/newsletter/subscribe` | Subscribe to newsletter |
| GET | `/newsletter/confirm?token=` | Confirm subscription |
| GET | `/newsletter/unsubscribe?token=` | Unsubscribe |
| GET | `/about` | Get the About page content |

## Authenticated (any logged-in user)

| Method | Path | Description |
|---|---|---|
| POST | `/auth/google` | Exchange Cognito ID token for app JWT |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user profile |
| POST | `/posts/:postId/comments` | Create a comment (pending approval) |
| DELETE | `/comments/:id` | Delete own comment |

## Admin only

| Method | Path | Description |
|---|---|---|
| POST | `/posts` | Create a post |
| PUT | `/posts/:id` | Update a post |
| DELETE | `/posts/:id` | Delete a post |
| PATCH | `/posts/:id/publish` | Publish/unpublish/schedule a post |
| GET | `/posts/admin` | List all posts regardless of status (drafts included), optionally filtered by `status` |
| GET | `/posts/admin/:id` | Get any post (including drafts) |
| GET | `/posts/:postId/comments/all` | List all comments for one post (including unapproved) |
| GET | `/comments/admin` | List all comments across every post, filterable by approval status |
| POST | `/comments/:id/reply` | Reply to a top-level comment as "Broomn" — auto-approved, notifies the original commenter by email |
| PATCH | `/comments/:id/approve` | Approve/reject a comment |
| GET | `/newsletter/subscribers` | List all subscribers |
| POST | `/newsletter/send` | Send newsletter to confirmed subscribers |
| POST | `/media/upload` | Upload an image (multipart, 5MB max) |
| GET | `/media` | List all media with usage count |
| GET | `/media/:id` | Get media details with posts (and whether the About page) uses it |
| DELETE | `/media/:id` | Delete a media file |
| PATCH | `/media/:id/replace` | Replace image URL across all posts and the About page |
| PUT | `/about` | Update the About page content |
