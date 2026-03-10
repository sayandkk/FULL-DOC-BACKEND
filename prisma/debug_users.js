
// @ts-ignore
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany({
            include: { department: true },
            orderBy: { createdAt: 'desc' },
        });

        console.log('--- All Users ---');
        users.forEach(u => {
            console.log(`User: ${u.email}, Role: ${u.role}, Dept: ${u.department?.name} (${u.departmentId})`);
        });
    } catch (e) {
        console.error('Error fetching users:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
