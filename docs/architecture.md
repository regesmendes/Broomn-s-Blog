# Architecture

See the root [README](../README.md) for setup, the [API reference](./api.md) for endpoints, and [deployment](./deployment.md) for AWS/CDK details.

## Data Model

- **User**: email, name, avatar, role (ADMIN/USER), Google/Cognito IDs
- **Post**: title, slug (auto-generated), excerpt, content (HTML), cover image, status (DRAFT/PUBLISHED), publishedAt (enables scheduling)
- **Tag**: name, slug — many-to-many with posts
- **Comment**: content, approved flag, belongs to user and post; optional self-relation `parentId` (one level of threading — a reply can't itself be replied to) and `isOwnerReply` flag (masked to the "Broomn" persona in public responses, see "Reply as Broomn" below)
- **Newsletter**: email, status (PENDING/CONFIRMED/UNSUBSCRIBED), optional user link, `blockedAt` (nullable — admin block, orthogonal to `status`; see "Blocking a newsletter subscriber" below)
- **Media**: filename (S3 key), original name, mime type, size, public URL — many-to-many with posts via `MediaOnPosts` and with the About page via `MediaOnAboutPage`, kept in sync automatically whenever a post's or the About page's content is saved (see `syncMediaUsage` in `post.service.ts` / `about.service.ts`)
- **AboutPage**: content (HTML) — a singleton, exactly one row (seeded by migration), no title/tags/scheduling; many-to-many with media via `MediaOnAboutPage`

## Authentication Flow

1. User clicks "Sign in with Google" → redirected to Cognito Hosted UI
2. Cognito handles Google OAuth → redirects back with authorization code
3. Frontend exchanges code for tokens via Cognito's token endpoint
4. Frontend sends the Cognito ID token to `POST /auth/google`
5. API verifies the ID token using Cognito's JWKS public keys
6. API upserts the user in the database and issues its own JWT pair:
   - **Access token** (15 min) — sent on every request
   - **Refresh token** (7 days) — used to get new access tokens

## Architecture Decisions

### Cursor-based pagination

All list endpoints (`/posts`, `/posts/:postId/comments[/all]`, `/comments/admin`, `/newsletter/subscribers`, `/media`) use cursor pagination instead of `OFFSET`/`page`: the client passes `cursor` (the last-seen row's `id`) and gets back `{ data, meta: { nextCursor, hasMore } }`. This avoids two problems `page`/`skip` has at scale — the database has to walk past all skipped rows on every request (so page 500 costs far more than page 1), and rows can be duplicated or skipped across pages if data changes between requests.

- `api/src/lib/pagination.ts`'s `paginateWithCursor` fetches `limit + 1` rows to derive `hasMore` without a separate `COUNT(*)`.
- Every query orders by `[{ <field>: 'desc' }, { id: 'desc' }]` — the `id` tiebreaker is required because the primary sort field (e.g. `createdAt`) isn't unique; without it, rows with identical timestamps could be skipped or repeated across pages. Verified empirically against real Postgres with intentionally-tied timestamps, not just mocked unit tests.
- The API is forward-only (no `direction`/backward cursor) — the frontend's `useCursorPagination` hook keeps a client-side history of visited cursors so a "Previous" button works without the backend needing to support it, the same approach Stripe's and GitHub's APIs use.
- This trades away numbered-page jumping (no more "go to page 47") and any endpoint-wide `total` count. Where a total/breakdown is still genuinely useful for a dashboard (newsletter subscriber counts by status, admin comment moderation count), it's a separate, cheap indexed `COUNT()`/`groupBy` — unrelated to how deep the cursor pagination goes, so it doesn't reintroduce the scaling problem.

### Post scheduling via publishedAt

Rather than a simple boolean "published" flag, we use a `publishedAt` datetime combined with a `status` enum. A post is visible when `status = PUBLISHED AND publishedAt <= now()`. This means:
- Set publishedAt to now → immediately visible
- Set publishedAt to a future date → scheduled, becomes visible automatically at that time
- No cron jobs needed — the query handles it

### HMAC tokens for newsletter

Instead of storing confirmation tokens in the database, we generate HMAC tokens: `base64url(subscriberId + ":" + hmac(subscriberId, secret))`. The token can be verified without a database lookup, and there's nothing to expire or clean up.

### Blocking a newsletter subscriber

`NewsletterSubscriber.blockedAt` is a single nullable timestamp — `null` = not blocked, set = blocked — rather than a separate `blocked Boolean` (which could disagree with `blockedAt` if one write updates one and not the other) or a 4th `status` enum value (which would conflate "blocked" with "current lifecycle status"; a blocked address is still meaningfully "unsubscribed" from the reader's perspective, but "blocked" needs to survive independently of whatever `status` does next).

- **Admin block** (`PATCH /newsletter/subscribers/:id/block`): sets `blockedAt` and `status: 'UNSUBSCRIBED'` in one write — stops delivery immediately.
- **Admin unblock**: clears `blockedAt` only — `status` is left as `UNSUBSCRIBED`; re-subscribing afterward is a separate, explicit action, not implied by unblocking.
- **Self-service unsubscribe** (the existing HMAC token-link flow) only ever touches `status`, never `blockedAt` — this is what makes "unsubscribe but stay blocked" work for free with zero special-casing: a self-unsubscribe on an already-blocked row leaves `blockedAt` in place.
- **`subscribe()`** checks `blockedAt` before its usual upsert and rejects instead — without this, resubmitting the subscribe form would silently reset a blocked row's `status` back to `PENDING`, undoing the block.
- **`getConfirmedSubscribers()`** (used by `send()`) filters `blockedAt: null` too, as defense-in-depth alongside the `status` filter — a send should never depend on a blocked address also being `UNSUBSCRIBED` elsewhere holding true forever.
- No block-reason/audit-log table — the single timestamp covers everything above.

### Comment moderation

Comments are created with `approved = false` by default. They only appear publicly after an admin approves them. Comment owners can delete their own comments; admins can delete any comment.

A user can have at most `MAX_PENDING_COMMENTS_PER_USER` (default 15, `api/.env.example`) comments awaiting moderation at once — `commentService.create` counts the user's unapproved comments and returns a 429 once the cap is hit, with a translated message on the frontend telling them to wait for existing comments to be reviewed. This is a second layer on top of the per-user rate limit (10/min) below: the rate limit caps posting *speed*, this caps standing *volume* — without it, a user could stay just under the rate limit and still flood the moderation queue with hundreds of pending comments over time.

### Reply as Broomn (identity-masked admin replies)

The admin replies to comments under the "Broomn" persona while staying logged in with their real Google account — no second "Broomn" `User` row exists, since that would just relocate the identity problem rather than solve it.

- `Comment.parentId` (self-relation, nullable) gives one level of threading — a reply can't itself be replied to (`commentService.replyAsBroomn` rejects with `invalid_parent` if the target already has a `parentId`).
- `Comment.isOwnerReply` is set only by `commentRepository.createReply`, called from the admin-only `POST /comments/:id/reply` route.
- **Masking happens server-side, in the repository** (`maskOwnerReply` in `comment.repository.ts`), applied to every row (and nested reply) returned by the public `GET /posts/:postId/comments` endpoint — not just hidden in the UI. If `isOwnerReply` is true, the real `user` relation is swapped for a fixed `BROOMN_PERSONA` object (`{ id: null, name: 'Broomn', avatarUrl: '/images/logo.png' }`) before the response is ever serialized, so a direct API client can't see the real name/avatar either. Admin-only endpoints (`/comments/admin`, `/posts/:postId/comments/all`) skip masking — moderation needs the real identity.
- Owner replies are auto-approved (`approved: true` at creation) — the moderation queue exists to filter random visitor spam, not the trusted site owner's own replies.
- **Notifying the original commenter** reuses the existing SES `sendEmail` client directly — a one-off transactional email linking back to the post. This does *not* reuse the newsletter's HMAC-token link pattern: that pattern exists so a public link can *verify and mutate* state (confirm/unsubscribe) without a database lookup, but a reply notification just links to an already-public post page — there's no state-mutating action to protect, so the extra token would be complexity without a purpose. Best-effort: a failed send doesn't undo the reply, which is already persisted.

### On-the-fly translation chunking respects MyMemory's per-request limit

Posts and the About page are written in Portuguese and translated client-side on demand via MyMemory's free API (`frontend/src/lib/translate.ts`), which has a hard ~500-char limit per request. Content is split into chunks under that limit and translated independently, then rejoined. The splitter first breaks HTML between block-level elements (`p`, `h1-6`, `li`, `blockquote`, `div`, `figure`, `pre`) — always safe, since a boundary between blocks can't land inside a tag — then, for any single block still over the limit (e.g. one long paragraph), splits further at sentence boundaries, but only where inline-tag nesting is balanced (tracked via a running open/close-tag depth counter), so it never cuts through the middle of a `<strong>`/`<a>`/etc. that spans a sentence break. Falls back to a raw length-based cut only if no safe boundary exists at all (e.g. one inline tag alone longer than the limit) — accepted as a rare edge case that doesn't occur in practice for Tiptap-authored prose. Requests also pass a contact email (`de=`) to MyMemory, raising the daily quota from 5,000 to 50,000 words — chunking a long post means more requests for the same content, so the headroom matters more than it used to.

**The sentence-boundary path had a real bug for a while, silently never engaging.** `findSafeSplitPoints` scanned each block's raw string *including* its own outer wrapper tag (e.g. the `<p>` around everything) and started its depth counter at 0 — but that outer tag isn't an inline mark, and the code had no way to tell it apart from one, so depth went to 1 right at the start and never returned to 0 anywhere inside the block's real text. The "only cut where depth is 0" rule then never found a valid point, no matter how many real sentence breaks the text had, and every oversized block silently fell back to the raw length-cut path — not just the rare "one giant inline tag" case that fallback was meant for. Fixed by stripping the block's own outer wrapper before scanning (so depth genuinely starts at, and can return to, 0) and offsetting the returned split points back by the stripped prefix length. Caught by tracing the existing regression test through the real function and finding a mid-word cut where several legitimate sentence boundaries existed — none of the tests at the time asserted *where* a cut landed, only that chunks stayed under the length limit and rejoined correctly, so both the buggy and fixed behavior looked identical to them.

### Image captions live in post content, not as media metadata

Captions are tied to one specific occurrence of an image in one specific post's content — not a property of the image/media asset itself, since the same uploaded image can be reused across posts (or twice in one post) with a different caption each time. Storing a caption as a column on `MediaOnPosts` was ruled out: `syncMediaUsage()` (`api/src/services/post.service.ts`) blindly deletes and recreates that join table's rows on every post save based on a regex scan of the content, so any caption stored there would be wiped on the next save, and one join-table row can't represent two different captions for two occurrences of the same image anyway. Captions live inline in the post's HTML instead, as `<figure><img>...<figcaption>` — tied to the exact occurrence by construction, no schema or migration changes needed, and `syncMediaUsage`'s filename regex finds the image regardless of what wraps it.

Authored via two custom Tiptap node types (`frontend/src/components/tiptapFigureImage.ts`): `figureImage` (`<figure>`, reusing the existing `image` node unmodified as its first child) and `caption` (`<figcaption>`, plain editable inline content) — both use plain declarative `renderHTML`/`parseHTML`, no custom NodeView. `RichTextEditor`'s `insertImage(url)` handle keeps its exact signature but now runs a `setFigureImage` command instead of `setImage`, built the same `chain().focus()....run()` way, which is what carries over the insert-at-cursor guarantee for free. After inserting, the cursor moves into the new empty caption via `tr.mapping.map(pos, -1)` (mapping the pre-insert cursor position through the transaction's own step mapping) rather than hand-computed offsets, since `replaceSelectionWith` can split a surrounding paragraph — a block node can't sit inside a paragraph's inline content — shifting positions in ways fixed arithmetic gets wrong.

### About page is a singleton, not a Post

The About page (`/about`, admin editor at `/admin/about`) is deliberately its own model rather than a `Post` with a reserved slug — it doesn't need tags, a publish/schedule workflow, or listing/search, and reusing `Post` would mean filtering it out of every place that lists or searches posts. `AboutPage` has exactly one row, seeded by its migration so `/about` never 404s waiting for an admin to save content the first time; the API only ever finds-or-updates that row, there's no create/delete. It reuses the same editor UI (`RichTextEditor` + `ImagePickerModal`) and public rendering (`PostContent`, with the same on-the-fly Portuguese→English translation) as posts, and has its own `MediaOnAboutPage` join table — mirroring `MediaOnPosts` — so the media library's usage counts, the media detail panel, and "replace this image everywhere" all correctly account for images used on the About page too.

### Per-user rate limiting

The global rate limiter (`@fastify/rate-limit`, 100 req/min default) keys by authenticated user instead of IP when possible: its `keyGenerator` (in `api/src/app.ts`) attempts `request.jwtVerify()` and keys by `user:<sub>` on success, falling back to IP for anonymous requests. It verifies the token rather than just decoding it — trusting an unverified `sub` claim would let anyone dodge the limit by sending a fresh made-up token per request. A few high-abuse-risk routes are tightened further via per-route `config.rateLimit` (which inherits this same keyGenerator): `/newsletter/subscribe` (5/10min, public and a real SES-cost target), comment creation (10/min per user), and media upload (20/min per user).

**Known limitation, accepted for now**: `@fastify/rate-limit`'s default store is an in-memory `Map`, scoped to a single Lambda execution environment. Since API Gateway can spin up multiple concurrent Lambda instances, each with its own independent counter, this is a soft/best-effort limit rather than a mathematically exact global one under concurrent load. A true distributed limit would need a shared store (e.g. `@fastify/rate-limit`'s Redis option, via ElastiCache or Upstash) — real infra/cost disproportionate to this app's actual traffic. Revisit if usage ever grows enough for this gap to matter.

### WAF was attempted in front of the API Gateway, reverted — HTTP APIs aren't a supported WAF resource type

Motivated by a real finding: CloudWatch Logs Insights queries against `/aws/lambda/broomns-blog-api` showed several IPs doing exhaustive, automated probing for `.env`, `.git/config`, AWS/SSH credentials, `service-account.json`, GraphQL introspection, etc. — one IP alone hit 120+ such paths across three sweeps. That traffic reaches the Lambda before the application-level rate limiter above ever sees it (the rate limiter throttles *speed*, it doesn't recognize known-bad IPs or attack signatures), so a WAF layer still has real value here — just not the way this was first built.

A regional `AWS::WAFv2::WebACL` was added with a `CfnWebACLAssociation` pointing at the HTTP API's `$default` stage. It deployed fine in isolation (validated via a synth-only `Template.fromStack()` check beforehand), but the real `cdk deploy` failed: **AWS WAF's `WebACLAssociation` does not support API Gateway HTTP APIs (v2) at all** — only REST APIs (v1), ALB, AppSync, Cognito user pools, App Runner, Amplify, CloudFront, and Verified Access. `BromnBlog-Api` uses `apigatewayv2.HttpApi` throughout, so this was a fundamental incompatibility, not a fixable ARN typo — the isolated synth check validated the CloudFormation *schema* was well-formed, but couldn't catch a resource-type combination AWS itself rejects at deploy time. Because the WAF resources were bundled into the same `BromnBlog-Api` stack deploy as unrelated API changes, the failure rolled back the *entire* stack update, briefly taking the API back to pre-deploy code while the frontend (a separate stack) had already deployed successfully — a real lesson on blast radius from bundling infra-risk changes with app changes in one deploy.

**Reverted** rather than force-fixed under pressure. If WAF protection for the API is revisited, the two real options are: migrate the API Gateway from `HttpApi` to `RestApi` (a bigger, riskier change touching routing/integration throughout `api-stack.ts`), or front the HTTP API with a CloudFront distribution and attach the Web ACL there instead (CloudFront *is* a supported resource type — this is the standard pattern for exactly this situation, but means new infra: a distribution, DNS changes, and re-pointing `api.blogdobroomn.com`).

### CI/CD pipeline

**Branch flow**: feature branches → PR into `master` (everyday development, ungated) → PR from `master` into `prod` (a deliberate promotion step — merging into `prod` is what triggers a production deploy). `prod` has real GitHub branch protection: a PR is required (no direct pushes, no force-pushes, no deletions), and the CI workflow's three checks (`API`, `Frontend`, `Infrastructure`) must all pass against an up-to-date branch before the merge button is even enabled — this applies to repo admins too (`enforce_admins: true`). This repo was made **public** specifically to unlock branch protection: GitHub disables both classic branch protection rules and the newer Rulesets on private repos unless the account has GitHub Pro. The repo's git history was checked for secrets before flipping visibility — none found (no `.env` files, no AWS keys, no private keys were ever committed).

**CI** (`.github/workflows/ci.yml`) runs on every PR/push touching `master` or `prod`: lint + build (which is also the typecheck, via `tsc`) + test for `api`, and lint + typecheck + test + build for `frontend`, and build + test for `infrastructure`. Nothing here touches AWS.

Both workflows' `actions/setup-node` runners pin Node 24 (bumped from 20 after GitHub started emitting a runner-deprecation warning on Node 20; the Lambda *runtime* itself is unaffected and stays on Node 20 — see `NODEJS_20_X` in the CDK stacks — this only affects the GitHub Actions VM running `npm ci`/`cdk deploy`). Verified via clean-container reproduction (`node:24-bullseye`) that the full pipeline — `npm ci`, `prisma generate`, `api/scripts/fetch-migrate-engine.js`, `cdk synth --all` — behaves identically to Node 20.

**Deploy** (`.github/workflows/deploy.yml`) runs on push to `prod` (i.e. after a merge) and replays the manual procedure documented in [deployment](./deployment.md) in order — build frontend via OpenNext, sync static assets to S3, `cdk deploy --all`, invalidate CloudFront, invoke the migrate Lambda — as one automated job. Real Google OAuth credentials are always passed to `cdk deploy` (from GitHub Secrets), so it can never hit the placeholder-credential fallback that once overwrote Cognito's real Google IdP secret (see the footguns in [deployment](./deployment.md)) — every deploy is a full-stack deploy, safely.

**AWS auth**: GitHub Actions authenticates via OIDC (GitHub's `token.actions.githubusercontent.com` provider, already registered in this AWS account for another project) assuming a dedicated IAM role, `broomns-blog-github-deploy`. Its trust policy restricts assumption to `repo:regesmendes/Broomn-s-Blog:ref:refs/heads/prod` only — no other branch, PR, or repo can assume it. No long-lived AWS access keys are stored anywhere. Its permissions are least-privilege, not broad admin:
- `sts:AssumeRole`/`sts:TagSession` on the existing CDK bootstrap roles (`cdk-hnb659fds-*`) — the same mechanism the CDK CLI already uses for the human deploy user; the actual CloudFormation/resource permissions live on those pre-existing bootstrap roles, scoped by CDK itself.
- `s3:PutObject`/`DeleteObject`/`ListBucket` on the frontend bucket only.
- `cloudfront:CreateInvalidation`/`GetInvalidation` on the one distribution only.
- `lambda:InvokeFunction` on the one migrate Lambda only.

**GitHub repo configuration** (for reproducing this setup, or auditing what's in place): Secrets — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (pulled from the live Cognito Google IdP config, not re-typed by hand). Variables (non-secret) — `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `HOSTED_ZONE_ID`, `CLOUDFRONT_DISTRIBUTION_ID`, `FRONTEND_BUCKET`, `MIGRATE_FUNCTION_NAME`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_COGNITO_DOMAIN`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_REDIRECT_URI`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

### Frontend outside npm workspace

Next.js has known issues with React version resolution when placed in an npm workspace alongside other packages. The frontend manages its own `node_modules` independently to avoid duplicate React instances causing `useContext` errors during build.

### Favicon spinner: three signal sources, two of them went through failed attempts first

`frontend/src/lib/loadingIndicator.ts` is a tiny module-level pub/sub (not React context — it's driven from outside any single component tree) combining independent signals into one loading boolean. Getting the route-transition side right took three iterations, kept here because the failure modes are worth knowing before reaching for similar tricks elsewhere:

1. **In-flight API request counter** — incremented/decremented by `ApiClient.request()`, the single choke point every API call already goes through, so every existing and future call gets this for free with no per-page wiring. This part worked from the start, but on `localhost` most requests resolve in well under the 200ms show-delay (see below), so in practice it rarely shows anything on its own.
2. **~~Patching `history.pushState`/`replaceState`~~ — abandoned, never fired.** The App Router has no official "navigation started" event, and every client-side navigation goes through these two calls under the hood, so this seemed like a reasonable hook point. It never actually triggered in practice — almost certainly because the App Router's internal navigation code captured its own reference to the original `pushState` before our patch ran, so the patched version was simply never called by Next's router.
3. **`RouteLoading` dropped into a route's `loading.tsx`** (`frontend/src/components/RouteLoading.tsx`, wired up at `admin/loading.tsx`) — Next.js wraps that segment in a Suspense boundary and renders this as the fallback the instant navigation begins, unmounting it once the real page takes over. Conceptually correct and still in place (also gives an in-page spinner, not just the favicon), but alone it didn't visibly fix the reported problem — most of this app's pages are Client Components gated by `ProtectedRoute`, which is a plain conditional render rather than something that actually suspends, so it's not fully verified how reliably the Suspense boundary engages here.
4. **A global `click` listener** (`watchForNavigationClicks`) is what actually closed the gap: `isInternalNavigationClick` inspects each click (same-origin, left-click, no modifier keys, not `target="_blank"`/`download`, not a same-page hash link) and calls `startRouteTransition()` the instant a real navigation click is observed — plain DOM event bubbling, which fires unconditionally, so it doesn't depend on any framework internals the way the `history` patch did. A 10s safety-net timeout force-clears the flag in case a click looked like navigation but nothing ever completes it.

The "stop" signal for both (3) and (4) is the same: a `usePathname()`-keyed effect in `FaviconLoadingIndicator`, which only fires *after* the new route has actually rendered.

`FaviconLoadingIndicator` (mounted once in the root layout) subscribes to the combined signal and swaps the tab's `<link rel="icon">` href to a small rotating SVG (data URI, no network round-trip) while any signal is active, restoring the original href once they all clear. There's a 200ms delay before the spinner appears, so a fast request or transition doesn't cause a visible flash-then-restore flicker.

### Never conditionally `return null` from a top-level Provider

`ThemeProvider` (`frontend/src/lib/theme-context.tsx`) used to `return null` while waiting for a `mounted` flag to avoid a flash of the wrong theme. Since it wraps the *entire app* in the root layout, this silently suppressed the server-rendered output of **every page** — the whole admin panel and auth flow rendered as blank/not-found in production for a while before this was caught, and it was hard to trace because pages using `next-intl` translations still looked fine (next-intl inlines all message JSON into the RSC payload regardless of whether the page's own HTML rendered, which masked the bug on translated pages). Any provider that wraps the root layout must always render its `children` — do the actual flash-prevention with a synchronous pre-hydration `<script>` in `app/layout.tsx` instead (reads `localStorage`/`prefers-color-scheme`, applies `.dark` before first paint).

### The bare apex domain never renders app content — HTTP-based verification methods don't work here

`https://blogdobroomn.com` (no path) always 307-redirects to `/pt` with an **empty body** — next-intl's locale-redirect middleware fires before any page or layout ever renders, so nothing in the app (a GA snippet, a meta tag, anything) can ever appear in that specific response. This isn't just theoretical: Google Search Console's "Google Analytics" verification method failed with "could not find any Google Analytics tracking codes on the index page" for exactly this reason — Google's verifier deliberately does not follow redirects when checking domain ownership (otherwise redirecting to someone else's already-tagged site would "verify" a domain you don't own). Any other HTTP-content-based verification method (HTML meta tag, HTML file) would fail identically. The fix was a DNS TXT record instead (`GoogleSiteVerification` in `frontend-stack.ts`) — verified at the DNS layer, bypassing the redirect entirely.

### Migration Lambda doubles as an admin console

`api/src/migrate.ts` defaults to `prisma migrate deploy`, but also accepts `{ args, stdin }` in its invoke payload to run arbitrary one-off `prisma` CLI commands (e.g. `db execute --stdin` for a raw SQL statement) against the production database — it's the only Lambda with a network path into the private-subnet RDS instance, so it's the way to do any one-off admin task (like promoting the first user to `ADMIN`) without a bastion host. See [deployment](./deployment.md#running-database-migrations--one-off-admin-sql) for the invoke command.
