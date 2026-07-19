-- CreateTable
CREATE TABLE "about_page" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "about_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_on_about_page" (
    "mediaId" TEXT NOT NULL,
    "aboutPageId" TEXT NOT NULL,

    CONSTRAINT "media_on_about_page_pkey" PRIMARY KEY ("mediaId","aboutPageId")
);

-- AddForeignKey
ALTER TABLE "media_on_about_page" ADD CONSTRAINT "media_on_about_page_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_on_about_page" ADD CONSTRAINT "media_on_about_page_aboutPageId_fkey" FOREIGN KEY ("aboutPageId") REFERENCES "about_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the singleton row — the app always reads/updates this one row, and
-- never creates another, so the public /about page never 404s waiting for
-- an admin to save content for the first time.
INSERT INTO "about_page" ("id", "content", "updatedAt")
VALUES ('about-page-singleton', '<p>Content coming soon.</p>', CURRENT_TIMESTAMP);
