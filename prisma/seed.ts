import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('Master@123', 10)

  const master = await prisma.user.upsert({
    where: { email: 'master@hicon.com' },
    update: {},
    create: {
      email: 'master@hicon.com',
      name: 'Master Admin',
      password: hashedPassword,
      role: 'MASTER',
    },
  })

  console.log({ master })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

