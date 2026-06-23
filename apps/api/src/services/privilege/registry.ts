import type { ProductManifest } from '@invoice/shared/privilege';
import { prisma } from '../../lib/prisma.js';

export async function syncRegistryFromManifest(manifest: ProductManifest) {
  const menuIdByCode = new Map<string, string>();

  for (const item of manifest.menuItems.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const parentId = item.parentCode ? menuIdByCode.get(item.parentCode) : undefined;
    const menu = await prisma.menuItem.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        name: item.name,
        icon: item.icon,
        route: item.route,
        sortOrder: item.sortOrder,
        parentId,
      },
      update: {
        name: item.name,
        icon: item.icon,
        route: item.route,
        sortOrder: item.sortOrder,
        parentId,
      },
    });
    menuIdByCode.set(item.code, menu.id);
  }

  for (const mod of manifest.modules) {
    const module = await prisma.module.upsert({
      where: { code: mod.code },
      create: {
        code: mod.code,
        name: mod.name,
        icon: mod.icon,
        sortOrder: mod.sortOrder ?? 0,
      },
      update: {
        name: mod.name,
        icon: mod.icon,
        sortOrder: mod.sortOrder ?? 0,
      },
    });

    for (const form of mod.forms) {
      const dbForm = await prisma.form.upsert({
        where: { moduleId_code: { moduleId: module.id, code: form.code } },
        create: {
          moduleId: module.id,
          code: form.code,
          name: form.name,
          sortOrder: form.sortOrder ?? 0,
        },
        update: { name: form.name, sortOrder: form.sortOrder ?? 0 },
      });

      for (const section of form.sections ?? []) {
        const dbSection = await prisma.section.upsert({
          where: { formId_code: { formId: dbForm.id, code: section.code } },
          create: {
            formId: dbForm.id,
            code: section.code,
            name: section.name,
            sortOrder: section.sortOrder ?? 0,
          },
          update: { name: section.name, sortOrder: section.sortOrder ?? 0 },
        });

        for (const field of section.fields) {
          await prisma.field.upsert({
            where: { sectionId_code: { sectionId: dbSection.id, code: field.code } },
            create: {
              sectionId: dbSection.id,
              code: field.code,
              name: field.name,
              dataType: field.dataType,
              defaultRequired: field.defaultRequired ?? false,
              defaultMaskPattern: field.defaultMaskPattern,
              isPii: field.isPii ?? false,
              sortOrder: field.sortOrder ?? 0,
            },
            update: {
              name: field.name,
              dataType: field.dataType,
              defaultRequired: field.defaultRequired ?? false,
              defaultMaskPattern: field.defaultMaskPattern,
              isPii: field.isPii ?? false,
              sortOrder: field.sortOrder ?? 0,
            },
          });
        }
      }

      for (const btn of form.buttons ?? []) {
        await prisma.button.upsert({
          where: { formId_code: { formId: dbForm.id, code: btn.code } },
          create: {
            formId: dbForm.id,
            code: btn.code,
            name: btn.name,
            variant: btn.variant ?? 'default',
            sortOrder: btn.sortOrder ?? 0,
          },
          update: {
            name: btn.name,
            variant: btn.variant ?? 'default',
            sortOrder: btn.sortOrder ?? 0,
          },
        });
      }
    }

    for (const action of mod.actions) {
      await prisma.actionDef.upsert({
        where: { moduleId_code: { moduleId: module.id, code: action.code } },
        create: {
          moduleId: module.id,
          code: action.code,
          name: action.name,
          isHighRisk: action.isHighRisk ?? false,
        },
        update: { name: action.name, isHighRisk: action.isHighRisk ?? false },
      });
    }

    for (const bulk of mod.bulkActions) {
      await prisma.bulkActionDef.upsert({
        where: { moduleId_code: { moduleId: module.id, code: bulk.code } },
        create: {
          moduleId: module.id,
          code: bulk.code,
          name: bulk.name,
          isHighRisk: bulk.isHighRisk ?? true,
        },
        update: { name: bulk.name, isHighRisk: bulk.isHighRisk ?? true },
      });
    }

    for (const tr of mod.transitions) {
      await prisma.statusTransitionDef.upsert({
        where: { moduleId_code: { moduleId: module.id, code: tr.code } },
        create: {
          moduleId: module.id,
          code: tr.code,
          name: tr.name,
          fromStatus: tr.fromStatus,
          toStatus: tr.toStatus,
        },
        update: {
          name: tr.name,
          fromStatus: tr.fromStatus,
          toStatus: tr.toStatus,
        },
      });
    }

    for (const scope of mod.scopes) {
      const existing = await prisma.recordScopeDef.findFirst({
        where: { moduleId: module.id, code: scope.code },
      });
      if (existing) {
        await prisma.recordScopeDef.update({
          where: { id: existing.id },
          data: {
            name: scope.name,
            ownerField: scope.ownerField,
            teamField: scope.teamField,
            branchField: scope.branchField,
            departmentField: scope.departmentField,
          },
        });
      } else {
        await prisma.recordScopeDef.create({
          data: {
            moduleId: module.id,
            code: scope.code,
            name: scope.name,
            ownerField: scope.ownerField,
            teamField: scope.teamField,
            branchField: scope.branchField,
            departmentField: scope.departmentField,
          },
        });
      }
    }

    for (const col of mod.listColumns) {
      await prisma.listColumnDef.upsert({
        where: { moduleId_code: { moduleId: module.id, code: col.code } },
        create: {
          moduleId: module.id,
          code: col.code,
          name: col.name,
          fieldCode: col.fieldCode,
          defaultMaskPattern: col.defaultMaskPattern,
          sortOrder: col.sortOrder ?? 0,
        },
        update: {
          name: col.name,
          fieldCode: col.fieldCode,
          defaultMaskPattern: col.defaultMaskPattern,
          sortOrder: col.sortOrder ?? 0,
        },
      });
    }

    for (const filter of mod.listFilters) {
      await prisma.listFilterDef.upsert({
        where: { moduleId_code: { moduleId: module.id, code: filter.code } },
        create: {
          moduleId: module.id,
          code: filter.code,
          name: filter.name,
          sortOrder: filter.sortOrder ?? 0,
        },
        update: { name: filter.name, sortOrder: filter.sortOrder ?? 0 },
      });
    }
  }

  for (const report of manifest.reports) {
    await prisma.reportDef.upsert({
      where: { code: report.code },
      create: report,
      update: report,
    });
  }

  for (const widget of manifest.dashboardWidgets) {
    await prisma.dashboardWidgetDef.upsert({
      where: { code: widget.code },
      create: widget,
      update: widget,
    });
  }
}
