-- CreateTable
CREATE TABLE "support_page" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_on_support_page" (
    "mediaId" TEXT NOT NULL,
    "supportPageId" TEXT NOT NULL,

    CONSTRAINT "media_on_support_page_pkey" PRIMARY KEY ("mediaId","supportPageId")
);

-- AddForeignKey
ALTER TABLE "media_on_support_page" ADD CONSTRAINT "media_on_support_page_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_on_support_page" ADD CONSTRAINT "media_on_support_page_supportPageId_fkey" FOREIGN KEY ("supportPageId") REFERENCES "support_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the singleton row — the app always reads/updates this one row, and
-- never creates another, so the public /support page never 404s waiting for
-- an admin to save content for the first time.
INSERT INTO "support_page" ("id", "content", "updatedAt")
VALUES ('support-page-singleton', '<p>Content coming soon.</p>', CURRENT_TIMESTAMP);
