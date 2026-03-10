import { PrismaClient, Role, MovementAction, FileStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Constants ───────────────────────────────────────────────────────────────

const USERS: any[] = [
  {
    email: 'admin@docflow.gov',
    password: 'Admin@123',
    firstName: 'System',
    lastName: 'Admin',
    role: Role.ADMIN,
    deptCode: 'ADMIN',
    designation: 'System Administrator',
    employeeId: 'EMP-001',
  },
  /*
  {
    // Applicant – raises approval requests / files
    email: 'applicant@docflow.gov',
    password: 'Applicant@123',
    firstName: 'Ravi',
    lastName: 'Kumar',
    role: Role.OFFICER,
    deptCode: 'FIN',
    designation: 'Finance Officer',
    employeeId: 'EMP-002',
  },
  {
    // First-level Approver – e.g. Finance Supervisor
    email: 'finance.approver@docflow.gov',
    password: 'Approver@123',
    firstName: 'Priya',
    lastName: 'Sharma',
    role: Role.SUPERVISOR,
    deptCode: 'FIN',
    designation: 'Finance Supervisor',
    employeeId: 'EMP-003',
  },
  {
    // Final Approver – e.g. CEO / Department Head
    email: 'ceo@docflow.gov',
    password: 'Ceo@123',
    firstName: 'Anil',
    lastName: 'Mehta',
    role: Role.DEPT_HEAD,
    deptCode: 'ADMIN',
    designation: 'Chief Executive Officer',
    employeeId: 'EMP-004',
  },
  */
];

const DEPARTMENTS = [
  { name: 'Administration', code: 'ADMIN', description: 'General Administration & Executive Office' },
  { name: 'Finance', code: 'FIN', description: 'Finance and Accounts Department' },
  { name: 'Human Resources', code: 'HR', description: 'Human Resources Department' },
  { name: 'Legal', code: 'LEGAL', description: 'Legal Affairs Department' },
  { name: 'Engineering', code: 'ENG', description: 'Engineering and Infrastructure' },
];

const CLASSIFICATIONS = [
  { name: 'Internal', type: 'NORMAL' },
  { name: 'Confidential', type: 'NORMAL' },
  { name: 'Public', type: 'NORMAL' },
  { name: 'Restricted', type: 'NORMAL' },
];

async function main() {
  console.log('\n🌱  Starting database seed...\n');

  // ── 1. Departments ──────────────────────────────────────────────────────────
  console.log('📂  Creating departments...');
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, description: dept.description },
      create: dept,
    });
    console.log(`   ✔  ${dept.name} (${dept.code})`);
  }

  // ── 2. Users ────────────────────────────────────────────────────────────────
  console.log('\n👤  Creating users...');
  const createdUsers: Record<string, { id: string; email: string; role: Role }> = {};

  for (const u of USERS) {
    const dept = await prisma.department.findUnique({ where: { code: u.deptCode } });
    const hashed = await bcrypt.hash(u.password, 10);

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: hashed,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        status: 'ACTIVE',
        departmentId: dept?.id,
        designation: u.designation,
        employeeId: u.employeeId,
      },
    });

    createdUsers[u.role === Role.ADMIN && u.employeeId === 'EMP-001' ? 'admin' :
      u.role === Role.OFFICER ? 'applicant' :
        u.role === Role.SUPERVISOR ? 'financeApprover' : 'ceo'] = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    console.log(`   ✔  [${u.role.padEnd(10)}] ${u.firstName} ${u.lastName} <${u.email}>`);
  }

  // ── 3. Classifications ──────────────────────────────────────────────────────
  console.log('\n🏷️  Creating classifications...');
  for (const c of CLASSIFICATIONS) {
    await prisma.classification.upsert({
      where: { name: c.name },
      update: {},
      create: {
        name: c.name,
        type: c.type as any,
        createdById: createdUsers.admin.id,
      },
    });
    console.log(`   ✔  ${c.name}`);
  }

  // ── 4. Sample File with Approval Workflow ───────────────────────────────────
  /*
  console.log('\n📄  Creating sample file with approval workflow...');

  const finDept = await prisma.department.findUnique({ where: { code: 'FIN' } });
  const confClass = await prisma.classification.findUnique({ where: { name: 'Confidential' } });

  // Check if sample file already exists
  const existingFile = await prisma.file.findFirst({
    where: { fileNumber: 'F-2026-0001' },
  });

  if (!existingFile) {
    // Step 1: Applicant creates a file
    const file = await prisma.file.create({
      data: {
        fileNumber: 'F-2026-0001',
        subject: 'Budget Approval Request – Q1 2026',
        description: 'Request for approval of Q1 2026 departmental budget allocation.',
        classificationId: confClass?.id,
        status: FileStatus.FORWARDED,
        departmentId: finDept!.id,
        createdById: createdUsers.applicant.id,
        currentOwnerId: createdUsers.ceo.id,
      },
    });

    // Step 2: Record movement trail
    // Movement 1 – Applicant creates and forwards to Finance Supervisor
    await prisma.fileMovement.create({
      data: {
        fileId: file.id,
        fromUserId: createdUsers.applicant.id,
        toUserId: createdUsers.financeApprover.id,
        action: MovementAction.CREATE,
        remarks: 'File created and submitted for Finance review.',
      },
    });

    // Movement 2 – Finance Supervisor forwards to CEO
    await prisma.fileMovement.create({
      data: {
        fileId: file.id,
        fromUserId: createdUsers.financeApprover.id,
        toUserId: createdUsers.ceo.id,
        action: MovementAction.FORWARD,
        remarks: 'Finance review complete. Forwarding to CEO for final approval.',
      },
    });

    console.log(`   ✔  File F-2026-0001 created with movement trail`);
    console.log(`      Applicant → Finance Supervisor → CEO (pending final approval)`);
  } else {
    console.log(`   ⚠  Sample file F-2026-0001 already exists, skipping.`);
  }
  */

  // ── 5. Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('✅  Seed complete! Login credentials:\n');
  console.log('  Role            Email                          Password');
  console.log('  ' + '─'.repeat(56));
  for (const u of USERS) {
    const roleLabel = u.role === Role.ADMIN ? 'Admin' :
      u.role === Role.OFFICER ? 'Applicant' :
        u.role === Role.SUPERVISOR ? 'Finance Approver' : 'CEO (Final Approver)';
    console.log(`  ${roleLabel.padEnd(16)}${u.email.padEnd(35)}${u.password}`);
  }
  console.log('─'.repeat(60) + '\n');
}

main()
  .catch((e) => {
    console.error('❌  Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
