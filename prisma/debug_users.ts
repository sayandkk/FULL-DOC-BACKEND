
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: { department: true },
        orderBy: { createdAt: 'desc' },
    });

    console.log('--- All Users ---');
    users.forEach(u => {
        console.log(`User: ${u.email}, Role: ${u.role}, Dept: ${u.department?.name} (${u.departmentId})`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
