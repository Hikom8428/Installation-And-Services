import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('Manoj@123', 10)

  const master = await prisma.user.upsert({
    where: { email: 'mis@hicon.co.in' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'mis@hicon.co.in',
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

