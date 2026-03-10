const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function reset() {
    const hash = await bcrypt.hash('admin123', 10);
    await prisma.user.update({
        where: { email: 'admin@docflow.gov' },
        data: { password: hash }
    });
    console.log('Success resetting admin@docflow.gov');
}

reset()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
