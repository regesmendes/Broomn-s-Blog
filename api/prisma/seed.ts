/**
 * Dev Seed Script
 *
 * Creates an admin user in the local database for development.
 * Run with: npm run db:seed
 *
 * This script should NEVER be used in production.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ This script cannot be run in production!')
    process.exit(1)
  }

  console.log('🌱 Seeding database...\n')

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@broomns-blog.local' },
    update: {},
    create: {
      email: 'admin@broomns-blog.local',
      name: 'Admin',
      role: 'ADMIN',
    },
  })

  console.log(`✅ Admin user created:`)
  console.log(`   ID:    ${admin.id}`)
  console.log(`   Email: ${admin.email}`)
  console.log(`   Role:  ${admin.role}`)

  // Create a regular user for testing comments
  const user = await prisma.user.upsert({
    where: { email: 'user@broomns-blog.local' },
    update: {},
    create: {
      email: 'user@broomns-blog.local',
      name: 'Test User',
      role: 'USER',
    },
  })

  console.log(`\n✅ Test user created:`)
  console.log(`   ID:    ${user.id}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Role:  ${user.role}`)

  // Create a sample post
  const post = await prisma.post.upsert({
    where: { slug: 'hello-world' },
    update: {},
    create: {
      title: 'Hello World',
      slug: 'hello-world',
      excerpt: 'Welcome to Broomn\'s Blog! This is the first post.',
      content: `
        <h2>Welcome!</h2>
        <p>This is a sample post created by the dev seed script. It demonstrates that the blog is working end-to-end.</p>
        <p>You can:</p>
        <ul>
          <li>See this post on the home page</li>
          <li>Click through to read the full content</li>
          <li>Create new posts via the admin panel or API</li>
          <li>Test comments and newsletter subscription</li>
        </ul>
        <h2>Next Steps</h2>
        <p>Try creating a new post using the admin panel at <code>/admin/posts/new</code>, or via the API with the dev token printed during seeding.</p>
      `.trim(),
      status: 'PUBLISHED',
      publishedAt: new Date(),
      tags: {
        create: [
          { tag: { create: { name: 'Welcome', slug: 'welcome' } } },
          { tag: { create: { name: 'Development', slug: 'development' } } },
        ],
      },
    },
  })

  console.log(`\n✅ Sample post created:`)
  console.log(`   Title: ${post.title}`)
  console.log(`   Slug:  ${post.slug}`)
  console.log(`   URL:   http://localhost:3000/posts/${post.slug}`)

  console.log('\n' + '─'.repeat(60))
  console.log('\n🚀 Seed complete! Use POST /auth/dev-login to get a token.\n')
  console.log('   curl -X POST http://localhost:3001/auth/dev-login \\')
  console.log('     -H "Content-Type: application/json" \\')
  console.log('     -d \'{"email":"admin@broomns-blog.local"}\'')
  console.log('\n' + '─'.repeat(60))
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
