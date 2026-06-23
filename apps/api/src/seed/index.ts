import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { calcInvoice, calcLine } from '@invoice/shared/calc';
import { prisma } from '../lib/prisma.js';
import { syncRegistryFromManifest } from '../services/privilege/registry.js';
import { invoiceManifest } from './invoice-registry.js';
import { resolveAllForUser } from '../services/privilege/resolver.js';

const DEFAULT_PASSWORD = 'Password@123';

async function seedRoles() {
  const roleDefs = [
    { code: 'SUPER_ADMIN', name: 'Super Admin', isSystem: true },
    { code: 'ADMIN', name: 'Administrator', isSystem: true },
    { code: 'ACCOUNTANT', name: 'Accountant', isSystem: true },
    { code: 'SALES', name: 'Sales', isSystem: true },
    { code: 'VIEWER', name: 'Viewer', isSystem: true },
    { code: 'AUDITOR', name: 'Auditor', isSystem: true },
  ];

  const roles: Record<string, string> = {};
  for (const def of roleDefs) {
    const role = await prisma.role.upsert({
      where: { code: def.code },
      create: def,
      update: { name: def.name },
    });
    roles[def.code] = role.id;
  }
  return roles;
}

async function seedRoleGrants(roles: Record<string, string>) {
  const allActions = await prisma.actionDef.findMany();
  const allModules = await prisma.module.findMany();
  const allBulk = await prisma.bulkActionDef.findMany();
  const allTransitions = await prisma.statusTransitionDef.findMany();
  const allFields = await prisma.field.findMany();
  const allColumns = await prisma.listColumnDef.findMany();

  async function grantAll(roleId: string, level: string, targets: { code: string }[], mode: string, mask?: string) {
    for (const t of targets) {
      await prisma.rolePrivilegeGrant.upsert({
        where: {
          roleId_targetLevel_targetId: {
            roleId,
            targetLevel: level,
            targetId: t.code,
          },
        },
        create: {
          roleId,
          targetLevel: level,
          targetId: t.code,
          mode,
          maskPattern: mask,
          createdBy: 'system',
        },
        update: { mode, maskPattern: mask },
      });
    }
  }

  // ADMIN - full access
  await grantAll(roles.ADMIN, 'MODULE', allModules, 'EDIT');
  await grantAll(roles.ADMIN, 'ACTION', allActions, 'ALLOW');
  await grantAll(roles.ADMIN, 'BULK_ACTION', allBulk, 'ALLOW');
  await grantAll(roles.ADMIN, 'STATUS_TRANSITION', allTransitions, 'ALLOW');
  await grantAll(roles.ADMIN, 'FIELD', allFields, 'EDIT');
  await grantAll(roles.ADMIN, 'LIST_COLUMN', allColumns, 'VISIBLE');
  await grantAll(roles.ADMIN, 'RECORD_SCOPE', allModules, 'ALL');

  const menuItems = await prisma.menuItem.findMany();
  await grantAll(roles.ADMIN, 'MENU_ITEM', menuItems, 'VISIBLE');

  const reports = await prisma.reportDef.findMany();
  await grantAll(roles.ADMIN, 'REPORT', reports, 'EXPORT');

  const widgets = await prisma.dashboardWidgetDef.findMany();
  await grantAll(roles.ADMIN, 'DASHBOARD_WIDGET', widgets, 'VISIBLE');

  // VIEWER - read only with masking
  await grantAll(roles.VIEWER, 'MODULE', allModules, 'VIEW');
  await grantAll(
    roles.VIEWER,
    'ACTION',
    allActions.filter((a) => a.code.includes('.LIST') || a.code.includes('.VIEW')),
    'ALLOW'
  );
  await grantAll(roles.VIEWER, 'BULK_ACTION', allBulk, 'DENY');
  await grantAll(roles.VIEWER, 'STATUS_TRANSITION', allTransitions, 'DENY');
  const piiFields = allFields.filter((f) => f.isPii);
  await grantAll(roles.VIEWER, 'FIELD', allFields.filter((f) => !f.isPii), 'VIEW');
  await grantAll(roles.VIEWER, 'FIELD', piiFields, 'MASKED', 'MASK_LAST_4');
  await grantAll(roles.VIEWER, 'LIST_COLUMN', allColumns, 'VISIBLE');
  await grantAll(roles.VIEWER, 'RECORD_SCOPE', allModules, 'ALL');
  await grantAll(roles.VIEWER, 'MENU_ITEM', menuItems, 'VISIBLE');
  await grantAll(roles.VIEWER, 'REPORT', reports, 'VIEW');
  await grantAll(roles.VIEWER, 'DASHBOARD_WIDGET', widgets, 'VISIBLE');

  // SALES - team scope, limited delete
  await grantAll(roles.SALES, 'MODULE', allModules.filter((m) => m.code !== 'PRIVILEGE_MGMT'), 'EDIT');
  await grantAll(
    roles.SALES,
    'ACTION',
    allActions.filter((a) => !a.code.includes('DELETE') && !a.code.includes('PRIVILEGE')),
    'ALLOW'
  );
  await grantAll(roles.SALES, 'BULK_ACTION', allBulk.filter((b) => b.code.includes('DELETE')), 'DENY');
  await grantAll(
    roles.SALES,
    'STATUS_TRANSITION',
    allTransitions.filter((t) => t.code !== 'INVOICE.PAID_TO_CANCELLED'),
    'ALLOW'
  );
  await grantAll(roles.SALES, 'RECORD_SCOPE', allModules, 'TEAM');
  await grantAll(roles.SALES, 'MENU_ITEM', menuItems.filter((m) => !m.code.includes('PRIVILEGE')), 'VISIBLE');

  // ACCOUNTANT
  await grantAll(roles.ACCOUNTANT, 'MODULE', allModules.filter((m) => m.code !== 'PRIVILEGE_MGMT'), 'EDIT');
  await grantAll(roles.ACCOUNTANT, 'ACTION', allActions.filter((a) => !a.code.includes('PRIVILEGE')), 'ALLOW');
  await grantAll(
    roles.ACCOUNTANT,
    'BULK_ACTION',
    allBulk.filter((b) => b.code.includes('DELETE')),
    'DENY'
  );
  const paidCancel = allTransitions.filter((t) => t.code === 'INVOICE.PAID_TO_CANCELLED');
  await grantAll(roles.ACCOUNTANT, 'STATUS_TRANSITION', paidCancel, 'ALLOW_WITH_APPROVAL');
  await grantAll(
    roles.ACCOUNTANT,
    'STATUS_TRANSITION',
    allTransitions.filter((t) => t.code !== 'INVOICE.PAID_TO_CANCELLED'),
    'ALLOW'
  );
  await grantAll(roles.ACCOUNTANT, 'RECORD_SCOPE', allModules, 'ALL');
}

async function main() {
  console.log('Seeding database...');

  await syncRegistryFromManifest(invoiceManifest);
  const roles = await seedRoles();
  await seedRoleGrants(roles);

  const branch1 = await prisma.branch.upsert({
    where: { id: 'branch-bangalore' },
    create: { id: 'branch-bangalore', name: 'Bangalore HQ' },
    update: {},
  });
  const branch2 = await prisma.branch.upsert({
    where: { id: 'branch-chennai' },
    create: { id: 'branch-chennai', name: 'Chennai Office' },
    update: {},
  });

  const dept1 = await prisma.department.upsert({
    where: { id: 'dept-finance' },
    create: { id: 'dept-finance', name: 'Finance' },
    update: {},
  });
  const dept2 = await prisma.department.upsert({
    where: { id: 'dept-sales' },
    create: { id: 'dept-sales', name: 'Sales' },
    update: {},
  });

  const team1 = await prisma.team.upsert({
    where: { id: 'team-alpha' },
    create: { id: 'team-alpha', name: 'Team Alpha', branchId: branch1.id },
    update: {},
  });
  const team2 = await prisma.team.upsert({
    where: { id: 'team-beta' },
    create: { id: 'team-beta', name: 'Team Beta', branchId: branch2.id },
    update: {},
  });

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const userDefs = [
    { email: 'super@accordex.com', fullName: 'Super Admin', role: 'SUPER_ADMIN', isSuperAdmin: true, teamId: team1.id, branchId: branch1.id, departmentId: dept1.id },
    { email: 'admin@accordex.com', fullName: 'Admin User', role: 'ADMIN', teamId: team1.id, branchId: branch1.id, departmentId: dept1.id },
    { email: 'accountant@accordex.com', fullName: 'Finance Accountant', role: 'ACCOUNTANT', teamId: team1.id, branchId: branch1.id, departmentId: dept1.id },
    { email: 'sales@accordex.com', fullName: 'Sales Rep', role: 'SALES', teamId: team1.id, branchId: branch1.id, departmentId: dept2.id },
    { email: 'viewer@accordex.com', fullName: 'Read Only Viewer', role: 'VIEWER', teamId: team2.id, branchId: branch2.id, departmentId: dept1.id },
    { email: 'auditor@accordex.com', fullName: 'Compliance Auditor', role: 'AUDITOR', teamId: team1.id, branchId: branch1.id, departmentId: dept1.id },
  ];

  const users: Record<string, string> = {};
  for (const def of userDefs) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      create: {
        email: def.email,
        fullName: def.fullName,
        passwordHash,
        isSuperAdmin: def.isSuperAdmin ?? false,
        teamId: def.teamId,
        branchId: def.branchId,
        departmentId: def.departmentId,
      },
      update: {
        fullName: def.fullName,
        passwordHash,
        isSuperAdmin: def.isSuperAdmin ?? false,
      },
    });
    users[def.email] = user.id;

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roles[def.role] } },
      create: { userId: user.id, roleId: roles[def.role], assignedBy: 'system' },
      update: {},
    });

    await resolveAllForUser(user.id);
  }

  await prisma.company.upsert({
    where: { id: 'company-1' },
    create: {
      id: 'company-1',
      name: 'Accordex Systems Pvt Ltd',
      email: 'billing@accordex.com',
      phone: '+91 80 4567 8900',
      gstin: '29AABCA1234A1Z5',
      pan: 'AABCA1234A',
      addressLine1: '42, MG Road',
      addressLine2: 'Level 5, Accordex Tower',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      country: 'India',
      bankName: 'HDFC Bank',
      accountNumber: '50200012345678',
      ifsc: 'HDFC0001234',
    },
    update: {},
  });

  const adminId = users['admin@accordex.com'];
  const salesId = users['sales@accordex.com'];

  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: 'cust-individual' },
      create: {
        id: 'cust-individual',
        name: 'Ravi Kumar',
        type: 'INDIVIDUAL',
        email: 'ravi.kumar@gmail.com',
        phone: '9876543210',
        billingAddress: '12, Residency Road',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560025',
        createdById: salesId,
        teamId: team1.id,
        branchId: branch1.id,
      },
      update: {},
    }),
    prisma.customer.upsert({
      where: { id: 'cust-karnataka' },
      create: {
        id: 'cust-karnataka',
        name: 'Karnataka Traders Pvt Ltd',
        type: 'BUSINESS',
        email: 'accounts@karnatakatraders.in',
        phone: '8023456789',
        gstin: '29AABCT1234B1Z8',
        billingAddress: '88, Industrial Area, Peenya',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560058',
        createdById: adminId,
        teamId: team1.id,
        branchId: branch1.id,
      },
      update: {},
    }),
    prisma.customer.upsert({
      where: { id: 'cust-tamilnadu' },
      create: {
        id: 'cust-tamilnadu',
        name: 'Tamil Nadu Exports Ltd',
        type: 'BUSINESS',
        email: 'finance@tnexports.com',
        phone: '4423456789',
        gstin: '33AABCT5678C1Z2',
        billingAddress: '15, Mount Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600002',
        createdById: adminId,
        teamId: team2.id,
        branchId: branch2.id,
      },
      update: {},
    }),
  ]);

  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'SVC-CONSULT' },
      create: { name: 'IT Consulting', type: 'SERVICE', sku: 'SVC-CONSULT', unit: 'HOUR', sellingPrice: 2500, taxRate: 18, hsnSac: '998314', category: 'Services', createdById: adminId },
      update: {},
    }),
    prisma.product.upsert({
      where: { sku: 'PRD-LAPTOP' },
      create: { name: 'Business Laptop', type: 'PRODUCT', sku: 'PRD-LAPTOP', unit: 'NOS', sellingPrice: 65000, taxRate: 18, hsnSac: '847130', category: 'Hardware', createdById: adminId },
      update: {},
    }),
    prisma.product.upsert({
      where: { sku: 'PRD-BOOK' },
      create: { name: 'Training Manual', type: 'PRODUCT', sku: 'PRD-BOOK', unit: 'NOS', sellingPrice: 500, taxRate: 5, hsnSac: '490110', category: 'Books', createdById: adminId },
      update: {},
    }),
    prisma.product.upsert({
      where: { sku: 'SVC-SUPPORT' },
      create: { name: 'Annual Support', type: 'SERVICE', sku: 'SVC-SUPPORT', unit: 'SET', sellingPrice: 12000, taxRate: 18, hsnSac: '998313', category: 'Services', createdById: adminId },
      update: {},
    }),
    prisma.product.upsert({
      where: { sku: 'PRD-EXEMPT' },
      create: { name: 'Exempt Item', type: 'PRODUCT', sku: 'PRD-EXEMPT', unit: 'NOS', sellingPrice: 1000, taxRate: 0, category: 'Exempt', createdById: adminId },
      update: {},
    }),
  ]);

  const invoiceData = [
    { id: 'inv-draft', number: 'INV-2025-0001', status: 'DRAFT', customer: customers[0], lines: [{ product: products[0], qty: 10, rate: 2500 }] },
    { id: 'inv-sent-1', number: 'INV-2025-0002', status: 'SENT', customer: customers[1], lines: [{ product: products[1], qty: 2, rate: 65000 }] },
    { id: 'inv-sent-2', number: 'INV-2025-0003', status: 'SENT', customer: customers[2], lines: [{ product: products[0], qty: 20, rate: 2500 }] },
    { id: 'inv-paid', number: 'INV-2025-0004', status: 'PAID', customer: customers[1], lines: [{ product: products[3], qty: 1, rate: 12000 }] },
    { id: 'inv-cancelled', number: 'INV-2025-0005', status: 'CANCELLED', customer: customers[0], lines: [{ product: products[2], qty: 5, rate: 500 }] },
  ];

  for (const inv of invoiceData) {
    const lineCalcs = inv.lines.map((l) => {
      const c = calcLine(l.qty, l.rate, 0, l.product.taxRate);
      return { product: l.product, qty: l.qty, rate: l.rate, ...c };
    });
    const totals = calcInvoice(
      inv.lines.map((l) => ({ quantity: l.qty, rate: l.rate, discountPct: 0, taxPct: l.product.taxRate })),
      { customerState: inv.customer.state, companyState: 'Karnataka', shipping: 0, roundOff: 0 }
    );

    await prisma.invoice.upsert({
      where: { id: inv.id },
      create: {
        id: inv.id,
        invoiceNumber: inv.number,
        invoiceDate: new Date('2025-06-01'),
        dueDate: new Date('2025-06-30'),
        paymentTerms: 'Net 30',
        customerId: inv.customer.id,
        billingAddress: inv.customer.billingAddress,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        taxableAmount: totals.taxableAmount,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        grandTotal: totals.grandTotal,
        amountInWords: totals.amountInWords,
        status: inv.status,
        createdById: salesId,
        teamId: team1.id,
        branchId: branch1.id,
        lineItems: {
          create: lineCalcs.map((l, idx) => ({
            productId: l.product.id,
            itemName: l.product.name,
            hsnSac: l.product.hsnSac,
            quantity: l.qty,
            unit: l.product.unit,
            rate: l.rate,
            taxPct: l.product.taxRate,
            gross: l.gross,
            discountAmt: l.discountAmt,
            taxableValue: l.taxableValue,
            taxAmt: l.taxAmt,
            lineTotal: l.lineTotal,
            sortOrder: idx,
          })),
        },
      },
      update: {},
    });
  }

  const templates = [
    {
      code: 'TPL_FRONT_DESK',
      name: 'Front Desk Receptionist',
      items: [
        { targetLevel: 'MODULE', targetId: 'CUSTOMERS', mode: 'VIEW' },
        { targetLevel: 'ACTION', targetId: 'CUSTOMER.LIST', mode: 'ALLOW' },
      ],
    },
    {
      code: 'TPL_AUDITOR',
      name: 'Read-Only Auditor',
      items: [
        { targetLevel: 'MODULE', targetId: 'INVOICES', mode: 'VIEW' },
        { targetLevel: 'ACTION', targetId: 'PRIVILEGE.AUDIT_VIEW', mode: 'ALLOW' },
      ],
    },
    {
      code: 'TPL_FINANCE',
      name: 'Finance Approver',
      items: [
        { targetLevel: 'ACTION', targetId: 'PRIVILEGE.APPROVAL_HANDLE', mode: 'ALLOW' },
        { targetLevel: 'STATUS_TRANSITION', targetId: 'INVOICE.PAID_TO_CANCELLED', mode: 'ALLOW' },
      ],
    },
  ];

  for (const tpl of templates) {
    const template = await prisma.privilegeTemplate.upsert({
      where: { code: tpl.code },
      create: { code: tpl.code, name: tpl.name, isSystem: true },
      update: { name: tpl.name },
    });
    await prisma.privilegeTemplateItem.deleteMany({ where: { templateId: template.id } });
    await prisma.privilegeTemplateItem.createMany({
      data: tpl.items.map((item) => ({ templateId: template.id, ...item })),
    });
  }

  await prisma.approvalRequest.upsert({
    where: { id: 'approval-pending' },
    create: {
      id: 'approval-pending',
      requesterId: users['accountant@accordex.com'],
      targetLevel: 'STATUS_TRANSITION',
      targetId: 'INVOICE.PAID_TO_CANCELLED',
      recordType: 'INVOICE',
      recordId: 'inv-paid',
      status: 'PENDING',
    },
    update: {},
  });

  await prisma.approvalRequest.upsert({
    where: { id: 'approval-approved' },
    create: {
      id: 'approval-approved',
      requesterId: users['accountant@accordex.com'],
      targetLevel: 'STATUS_TRANSITION',
      targetId: 'INVOICE.PAID_TO_CANCELLED',
      recordType: 'INVOICE',
      recordId: 'inv-cancelled',
      status: 'APPROVED',
      approverId: users['admin@accordex.com'],
      resolvedAt: new Date(),
    },
    update: {},
  });

  console.log('Seed completed successfully.');
  console.log(`Default password for all users: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
