-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_on_posts" (
    "mediaId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,

    CONSTRAINT "media_on_posts_pkey" PRIMARY KEY ("mediaId","postId")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_filename_key" ON "media"("filename");

-- AddForeignKey
ALTER TABLE "media_on_posts" ADD CONSTRAINT "media_on_posts_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_on_posts" ADD CONSTRAINT "media_on_posts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
