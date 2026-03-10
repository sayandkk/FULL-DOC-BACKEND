import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: { role: 'DEPT_HEAD' },
        include: { department: true }
    });
    console.log('DEPT_HEAD users:', users.map(u => ({ id: u.id, email: u.email, department: u.department?.name })));

    const files = await prisma.file.findMany({
        where: { status: { in: ['PENDING', 'FORWARDED', 'RETURNED'] } },
        include: { currentOwner: true, department: true, classification: true, currentStage: true }
    });
    console.log('\nActive Files:', files.map(f => ({
        id: f.id,
        subject: f.subject,
        status: f.status,
        ownerId: f.currentOwnerId,
        ownerRole: f.currentOwner?.role,
        department: f.department?.name,
        stage: f.currentStage ? f.currentStage.role : 'None (Custom)'
    })));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
