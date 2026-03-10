import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    await prisma.user.update({
        where: { email: 'admin@docflow.gov' },
        data: { password: hashedPassword }
    });
    console.log('Password reset successfully to admin123');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
