import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.findMany({
        select: { email: true, role: true },
        take: 5
    });
    console.log("USERS:", JSON.stringify(users, null, 2));
}

check()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
