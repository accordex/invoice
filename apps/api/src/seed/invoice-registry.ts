import type { ProductManifest } from '@invoice/shared/privilege';

export const invoiceManifest: ProductManifest = {
  product: { code: 'INVOICE', name: 'Invoice Generator' },

  menuItems: [
    { code: 'NAV_DASHBOARD', name: 'Dashboard', icon: 'home', route: '/dashboard', sortOrder: 1 },
    { code: 'NAV_INVOICES', name: 'Invoices', icon: 'file-text', route: '/invoices', sortOrder: 2 },
    { code: 'NAV_CUSTOMERS', name: 'Customers', icon: 'users', route: '/customers', sortOrder: 3 },
    { code: 'NAV_PRODUCTS', name: 'Products', icon: 'package', route: '/products', sortOrder: 4 },
    { code: 'NAV_REPORTS', name: 'Reports', icon: 'bar-chart', route: '/reports', sortOrder: 5 },
    { code: 'NAV_SETTINGS', name: 'Settings', icon: 'settings', route: '/settings', sortOrder: 6 },
    { code: 'NAV_SETTINGS_COMPANY', name: 'Company Profile', parentCode: 'NAV_SETTINGS', route: '/settings/company', sortOrder: 1 },
    { code: 'NAV_SETTINGS_PRIVILEGES', name: 'Roles & Permissions', parentCode: 'NAV_SETTINGS', route: '/admin/privileges', sortOrder: 2 },
    { code: 'NAV_SETTINGS_USERS', name: 'Users', parentCode: 'NAV_SETTINGS', route: '/admin/users', sortOrder: 3 },
  ],

  modules: [
    {
      code: 'COMPANY_PROFILE', name: 'Company Profile', icon: 'building', sortOrder: 1,
      forms: [{
        code: 'COMPANY_PROFILE_FORM', name: 'Company Profile',
        sections: [
          { code: 'COMPANY_IDENTITY', name: 'Identity', fields: [
            { code: 'COMPANY_NAME', name: 'Company Name', dataType: 'TEXT', defaultRequired: true },
            { code: 'COMPANY_LOGO', name: 'Logo', dataType: 'FILE' },
            { code: 'COMPANY_EMAIL', name: 'Business Email', dataType: 'EMAIL', defaultRequired: true, isPii: true, defaultMaskPattern: 'MASK_MIDDLE' },
            { code: 'COMPANY_PHONE', name: 'Phone', dataType: 'PHONE', defaultRequired: true, isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
          ]},
          { code: 'COMPANY_TAX', name: 'Tax Info', fields: [
            { code: 'COMPANY_GSTIN', name: 'GSTIN', dataType: 'TEXT', isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
            { code: 'COMPANY_PAN', name: 'PAN', dataType: 'TEXT', isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
          ]},
          { code: 'COMPANY_ADDRESS', name: 'Address', fields: [
            { code: 'COMPANY_ADDRESS1', name: 'Address Line 1', dataType: 'TEXT', defaultRequired: true },
            { code: 'COMPANY_ADDRESS2', name: 'Address Line 2', dataType: 'TEXT' },
            { code: 'COMPANY_CITY', name: 'City', dataType: 'TEXT', defaultRequired: true },
            { code: 'COMPANY_STATE', name: 'State', dataType: 'SELECT', defaultRequired: true },
            { code: 'COMPANY_PINCODE', name: 'Pincode', dataType: 'TEXT', defaultRequired: true },
            { code: 'COMPANY_COUNTRY', name: 'Country', dataType: 'SELECT', defaultRequired: true },
          ]},
          { code: 'COMPANY_FINANCIAL', name: 'Financial', fields: [
            { code: 'COMPANY_CURRENCY', name: 'Default Currency', dataType: 'SELECT', defaultRequired: true },
            { code: 'COMPANY_BANK_NAME', name: 'Bank Name', dataType: 'TEXT' },
            { code: 'COMPANY_ACCOUNT_NO', name: 'Account Number', dataType: 'TEXT', isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
            { code: 'COMPANY_IFSC', name: 'IFSC Code', dataType: 'TEXT' },
          ]},
        ],
        buttons: [
          { code: 'BTN_COMPANY_SAVE', name: 'Save', variant: 'primary' },
          { code: 'BTN_COMPANY_UPLOAD_LOGO', name: 'Upload Logo', variant: 'default' },
        ],
      }],
      actions: [
        { code: 'COMPANY.VIEW', name: 'View Company Profile' },
        { code: 'COMPANY.EDIT', name: 'Edit Company Profile' },
      ],
      bulkActions: [],
      transitions: [],
      scopes: [],
      listColumns: [],
      listFilters: [],
    },

    {
      code: 'CUSTOMERS', name: 'Customers', icon: 'users', sortOrder: 2,
      forms: [{
        code: 'CUSTOMER_FORM', name: 'Customer',
        sections: [
          { code: 'CUSTOMER_BASIC', name: 'Basic', fields: [
            { code: 'CUSTOMER_NAME', name: 'Name', dataType: 'TEXT', defaultRequired: true },
            { code: 'CUSTOMER_TYPE', name: 'Type', dataType: 'RADIO', defaultRequired: true },
          ]},
          { code: 'CUSTOMER_CONTACT', name: 'Contact', fields: [
            { code: 'CUSTOMER_EMAIL', name: 'Email', dataType: 'EMAIL', defaultRequired: true, isPii: true, defaultMaskPattern: 'MASK_MIDDLE' },
            { code: 'CUSTOMER_PHONE', name: 'Phone', dataType: 'PHONE', defaultRequired: true, isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
          ]},
          { code: 'CUSTOMER_TAX', name: 'Tax', fields: [
            { code: 'CUSTOMER_GSTIN', name: 'GSTIN', dataType: 'TEXT', isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
          ]},
          { code: 'CUSTOMER_ADDRESS', name: 'Address', fields: [
            { code: 'CUSTOMER_BILLING_ADDRESS', name: 'Billing Address', dataType: 'TEXTAREA', defaultRequired: true },
            { code: 'CUSTOMER_SHIPPING_ADDRESS', name: 'Shipping Address', dataType: 'TEXTAREA' },
            { code: 'CUSTOMER_CITY', name: 'City', dataType: 'TEXT', defaultRequired: true },
            { code: 'CUSTOMER_STATE', name: 'State', dataType: 'SELECT', defaultRequired: true },
            { code: 'CUSTOMER_PINCODE', name: 'Pincode', dataType: 'TEXT', defaultRequired: true },
          ]},
          { code: 'CUSTOMER_META', name: 'Meta', fields: [
            { code: 'CUSTOMER_NOTES', name: 'Notes', dataType: 'TEXTAREA' },
          ]},
        ],
        buttons: [
          { code: 'BTN_CUSTOMER_SAVE', name: 'Save', variant: 'primary' },
          { code: 'BTN_CUSTOMER_CANCEL', name: 'Cancel', variant: 'default' },
          { code: 'BTN_CUSTOMER_DELETE', name: 'Delete', variant: 'destructive' },
        ],
      }],
      actions: [
        { code: 'CUSTOMER.LIST', name: 'List Customers' },
        { code: 'CUSTOMER.VIEW', name: 'View Customer' },
        { code: 'CUSTOMER.CREATE', name: 'Create Customer' },
        { code: 'CUSTOMER.EDIT', name: 'Edit Customer' },
        { code: 'CUSTOMER.DELETE', name: 'Delete Customer', isHighRisk: true },
      ],
      bulkActions: [
        { code: 'CUSTOMER.BULK_DELETE', name: 'Bulk Delete', isHighRisk: true },
        { code: 'CUSTOMER.BULK_EXPORT', name: 'Bulk Export' },
      ],
      transitions: [],
      scopes: [{ code: 'DEFAULT', name: 'Customers', ownerField: 'createdById', teamField: 'teamId', branchField: 'branchId', departmentField: 'departmentId' }],
      listColumns: [
        { code: 'COL_CUSTOMER_NAME', name: 'Name', fieldCode: 'CUSTOMER_NAME', sortOrder: 1 },
        { code: 'COL_CUSTOMER_TYPE', name: 'Type', fieldCode: 'CUSTOMER_TYPE', sortOrder: 2 },
        { code: 'COL_CUSTOMER_EMAIL', name: 'Email', fieldCode: 'CUSTOMER_EMAIL', defaultMaskPattern: 'MASK_MIDDLE', sortOrder: 3 },
        { code: 'COL_CUSTOMER_PHONE', name: 'Phone', fieldCode: 'CUSTOMER_PHONE', defaultMaskPattern: 'MASK_LAST_4', sortOrder: 4 },
        { code: 'COL_CUSTOMER_GSTIN', name: 'GSTIN', fieldCode: 'CUSTOMER_GSTIN', defaultMaskPattern: 'MASK_LAST_4', sortOrder: 5 },
        { code: 'COL_CUSTOMER_CITY', name: 'City', fieldCode: 'CUSTOMER_CITY', sortOrder: 6 },
        { code: 'COL_CUSTOMER_CREATED', name: 'Created', sortOrder: 7 },
      ],
      listFilters: [
        { code: 'FILTER_CUSTOMER_TYPE', name: 'Customer Type', sortOrder: 1 },
        { code: 'FILTER_CUSTOMER_STATE', name: 'State', sortOrder: 2 },
        { code: 'FILTER_CUSTOMER_CITY', name: 'City', sortOrder: 3 },
        { code: 'FILTER_CUSTOMER_ACTIVE', name: 'Active Status', sortOrder: 4 },
      ],
    },

    {
      code: 'PRODUCTS', name: 'Product Catalog', icon: 'package', sortOrder: 3,
      forms: [{
        code: 'PRODUCT_FORM', name: 'Product',
        sections: [
          { code: 'PRODUCT_BASIC', name: 'Basic', fields: [
            { code: 'PRODUCT_NAME', name: 'Item Name', dataType: 'TEXT', defaultRequired: true },
            { code: 'PRODUCT_TYPE', name: 'Item Type', dataType: 'RADIO', defaultRequired: true },
            { code: 'PRODUCT_SKU', name: 'SKU', dataType: 'TEXT' },
            { code: 'PRODUCT_DESCRIPTION', name: 'Description', dataType: 'TEXTAREA' },
            { code: 'PRODUCT_HSN_SAC', name: 'HSN/SAC', dataType: 'TEXT' },
          ]},
          { code: 'PRODUCT_PRICING', name: 'Pricing', fields: [
            { code: 'PRODUCT_UNIT', name: 'Unit', dataType: 'SELECT', defaultRequired: true },
            { code: 'PRODUCT_PRICE', name: 'Selling Price', dataType: 'CURRENCY', defaultRequired: true },
          ]},
          { code: 'PRODUCT_TAX', name: 'Tax', fields: [
            { code: 'PRODUCT_TAX_RATE', name: 'Tax Rate (%)', dataType: 'SELECT', defaultRequired: true },
          ]},
          { code: 'PRODUCT_META', name: 'Categorisation', fields: [
            { code: 'PRODUCT_CATEGORY', name: 'Category', dataType: 'TEXT' },
          ]},
        ],
        buttons: [
          { code: 'BTN_PRODUCT_SAVE', name: 'Save', variant: 'primary' },
          { code: 'BTN_PRODUCT_CANCEL', name: 'Cancel', variant: 'default' },
          { code: 'BTN_PRODUCT_DELETE', name: 'Delete', variant: 'destructive' },
        ],
      }],
      actions: [
        { code: 'PRODUCT.LIST', name: 'List Products' },
        { code: 'PRODUCT.VIEW', name: 'View Product' },
        { code: 'PRODUCT.CREATE', name: 'Create Product' },
        { code: 'PRODUCT.EDIT', name: 'Edit Product' },
        { code: 'PRODUCT.DELETE', name: 'Delete Product', isHighRisk: true },
      ],
      bulkActions: [
        { code: 'PRODUCT.BULK_DELETE', name: 'Bulk Delete', isHighRisk: true },
        { code: 'PRODUCT.BULK_IMPORT', name: 'Bulk Import from CSV' },
        { code: 'PRODUCT.BULK_EXPORT', name: 'Bulk Export' },
      ],
      transitions: [],
      scopes: [{ code: 'DEFAULT', name: 'Products', ownerField: 'createdById' }],
      listColumns: [
        { code: 'COL_PRODUCT_NAME', name: 'Item Name', fieldCode: 'PRODUCT_NAME', sortOrder: 1 },
        { code: 'COL_PRODUCT_TYPE', name: 'Type', fieldCode: 'PRODUCT_TYPE', sortOrder: 2 },
        { code: 'COL_PRODUCT_SKU', name: 'SKU', fieldCode: 'PRODUCT_SKU', sortOrder: 3 },
        { code: 'COL_PRODUCT_UNIT', name: 'Unit', fieldCode: 'PRODUCT_UNIT', sortOrder: 4 },
        { code: 'COL_PRODUCT_PRICE', name: 'Price', fieldCode: 'PRODUCT_PRICE', sortOrder: 5 },
        { code: 'COL_PRODUCT_TAX', name: 'Tax %', fieldCode: 'PRODUCT_TAX_RATE', sortOrder: 6 },
      ],
      listFilters: [
        { code: 'FILTER_PRODUCT_TYPE', name: 'Type', sortOrder: 1 },
        { code: 'FILTER_PRODUCT_CATEGORY', name: 'Category', sortOrder: 2 },
        { code: 'FILTER_PRODUCT_ACTIVE', name: 'Active Status', sortOrder: 3 },
        { code: 'FILTER_PRODUCT_TAX_RATE', name: 'Tax Rate', sortOrder: 4 },
      ],
    },

    {
      code: 'INVOICES', name: 'Invoices', icon: 'file-text', sortOrder: 4,
      forms: [{
        code: 'INVOICE_FORM', name: 'Invoice',
        sections: [
          { code: 'INVOICE_HEADER', name: 'Invoice Header', fields: [
            { code: 'INVOICE_NUMBER', name: 'Invoice Number', dataType: 'TEXT', defaultRequired: true },
            { code: 'INVOICE_DATE', name: 'Invoice Date', dataType: 'DATE', defaultRequired: true },
            { code: 'INVOICE_DUE_DATE', name: 'Due Date', dataType: 'DATE', defaultRequired: true },
            { code: 'INVOICE_REFERENCE', name: 'Reference / PO Number', dataType: 'TEXT' },
            { code: 'INVOICE_PAYMENT_TERMS', name: 'Payment Terms', dataType: 'SELECT', defaultRequired: true },
          ]},
          { code: 'INVOICE_CUSTOMER', name: 'Customer Selection', fields: [
            { code: 'INVOICE_CUSTOMER_ID', name: 'Customer', dataType: 'SELECT', defaultRequired: true },
            { code: 'INVOICE_BILLING_ADDRESS', name: 'Billing Address', dataType: 'TEXTAREA' },
            { code: 'INVOICE_SHIPPING_ADDRESS', name: 'Shipping Address', dataType: 'TEXTAREA' },
          ]},
          { code: 'INVOICE_LINE_ITEMS', name: 'Line Items', fields: [
            { code: 'LINE_ITEM_PRODUCT', name: 'Item', dataType: 'SELECT', defaultRequired: true },
            { code: 'LINE_ITEM_DESCRIPTION', name: 'Description', dataType: 'TEXT' },
            { code: 'LINE_ITEM_HSN', name: 'HSN/SAC', dataType: 'TEXT' },
            { code: 'LINE_ITEM_QTY', name: 'Quantity', dataType: 'NUMBER', defaultRequired: true },
            { code: 'LINE_ITEM_UNIT', name: 'Unit', dataType: 'TEXT' },
            { code: 'LINE_ITEM_RATE', name: 'Rate', dataType: 'CURRENCY', defaultRequired: true },
            { code: 'LINE_ITEM_DISCOUNT_PCT', name: 'Discount %', dataType: 'NUMBER' },
            { code: 'LINE_ITEM_TAX_PCT', name: 'Tax %', dataType: 'SELECT', defaultRequired: true },
            { code: 'LINE_ITEM_AMOUNT', name: 'Amount', dataType: 'CURRENCY' },
          ]},
          { code: 'INVOICE_TOTALS', name: 'Totals & Summary', fields: [
            { code: 'INVOICE_SUBTOTAL', name: 'Subtotal', dataType: 'CURRENCY' },
            { code: 'INVOICE_TOTAL_DISCOUNT', name: 'Total Discount', dataType: 'CURRENCY' },
            { code: 'INVOICE_TAXABLE', name: 'Taxable Amount', dataType: 'CURRENCY' },
            { code: 'INVOICE_CGST', name: 'CGST', dataType: 'CURRENCY' },
            { code: 'INVOICE_SGST', name: 'SGST', dataType: 'CURRENCY' },
            { code: 'INVOICE_IGST', name: 'IGST', dataType: 'CURRENCY' },
            { code: 'INVOICE_SHIPPING', name: 'Shipping Charges', dataType: 'CURRENCY' },
            { code: 'INVOICE_ROUND_OFF', name: 'Round Off', dataType: 'CURRENCY' },
            { code: 'INVOICE_GRAND_TOTAL', name: 'Grand Total', dataType: 'CURRENCY' },
            { code: 'INVOICE_AMOUNT_IN_WORDS', name: 'Amount in Words', dataType: 'TEXT' },
          ]},
          { code: 'INVOICE_FOOTER', name: 'Footer', fields: [
            { code: 'INVOICE_NOTES', name: 'Notes to Customer', dataType: 'TEXTAREA' },
            { code: 'INVOICE_TERMS', name: 'Terms & Conditions', dataType: 'TEXTAREA' },
            { code: 'INVOICE_STATUS', name: 'Status', dataType: 'SELECT' },
            { code: 'INVOICE_ATTACHMENT', name: 'Attachment', dataType: 'FILE' },
          ]},
        ],
        buttons: [
          { code: 'BTN_INVOICE_SAVE_DRAFT', name: 'Save as Draft', variant: 'default' },
          { code: 'BTN_INVOICE_SAVE_PREVIEW', name: 'Save & Preview', variant: 'primary' },
          { code: 'BTN_INVOICE_CANCEL', name: 'Cancel', variant: 'default' },
          { code: 'BTN_INVOICE_ADD_LINE', name: 'Add Line Item', variant: 'default' },
          { code: 'BTN_INVOICE_DELETE_LINE', name: 'Delete Line', variant: 'destructive' },
          { code: 'BTN_INVOICE_DOWNLOAD_PDF', name: 'Download PDF', variant: 'default' },
          { code: 'BTN_INVOICE_PRINT', name: 'Print', variant: 'default' },
        ],
      }],
      actions: [
        { code: 'INVOICE.LIST', name: 'List Invoices' },
        { code: 'INVOICE.VIEW', name: 'View Invoice' },
        { code: 'INVOICE.CREATE', name: 'Create Invoice' },
        { code: 'INVOICE.EDIT', name: 'Edit Invoice' },
        { code: 'INVOICE.DELETE', name: 'Delete Invoice', isHighRisk: true },
        { code: 'INVOICE.DUPLICATE', name: 'Duplicate Invoice' },
        { code: 'INVOICE.DOWNLOAD_PDF', name: 'Download PDF' },
        { code: 'INVOICE.PRINT', name: 'Print Invoice' },
      ],
      bulkActions: [
        { code: 'INVOICE.BULK_SEND', name: 'Bulk Send', isHighRisk: true },
        { code: 'INVOICE.BULK_MARK_PAID', name: 'Bulk Mark as Paid', isHighRisk: true },
        { code: 'INVOICE.BULK_EXPORT', name: 'Bulk Export' },
        { code: 'INVOICE.BULK_DELETE', name: 'Bulk Delete', isHighRisk: true },
      ],
      transitions: [
        { code: 'INVOICE.DRAFT_TO_SENT', name: 'Send Invoice', fromStatus: 'DRAFT', toStatus: 'SENT' },
        { code: 'INVOICE.DRAFT_TO_CANCELLED', name: 'Discard Draft', fromStatus: 'DRAFT', toStatus: 'CANCELLED' },
        { code: 'INVOICE.SENT_TO_PAID', name: 'Mark as Paid', fromStatus: 'SENT', toStatus: 'PAID' },
        { code: 'INVOICE.SENT_TO_CANCELLED', name: 'Cancel Sent Invoice', fromStatus: 'SENT', toStatus: 'CANCELLED' },
        { code: 'INVOICE.PAID_TO_CANCELLED', name: 'Reverse Paid Invoice', fromStatus: 'PAID', toStatus: 'CANCELLED' },
      ],
      scopes: [{ code: 'DEFAULT', name: 'Invoices', ownerField: 'createdById', teamField: 'teamId', branchField: 'branchId', departmentField: 'departmentId' }],
      listColumns: [
        { code: 'COL_INVOICE_NUMBER', name: 'Invoice #', fieldCode: 'INVOICE_NUMBER', sortOrder: 1 },
        { code: 'COL_INVOICE_DATE', name: 'Date', fieldCode: 'INVOICE_DATE', sortOrder: 2 },
        { code: 'COL_INVOICE_CUSTOMER', name: 'Customer', sortOrder: 3 },
        { code: 'COL_INVOICE_DUE', name: 'Due Date', fieldCode: 'INVOICE_DUE_DATE', sortOrder: 4 },
        { code: 'COL_INVOICE_AMOUNT', name: 'Amount', fieldCode: 'INVOICE_GRAND_TOTAL', sortOrder: 5 },
        { code: 'COL_INVOICE_STATUS', name: 'Status', fieldCode: 'INVOICE_STATUS', sortOrder: 6 },
        { code: 'COL_INVOICE_CREATED_BY', name: 'Created By', sortOrder: 7 },
      ],
      listFilters: [
        { code: 'FILTER_INVOICE_STATUS', name: 'Status', sortOrder: 1 },
        { code: 'FILTER_INVOICE_DATE_RANGE', name: 'Date Range', sortOrder: 2 },
        { code: 'FILTER_INVOICE_CUSTOMER', name: 'Customer', sortOrder: 3 },
        { code: 'FILTER_INVOICE_CREATED_BY', name: 'Created By', sortOrder: 4 },
        { code: 'FILTER_INVOICE_AMOUNT_RANGE', name: 'Amount Range', sortOrder: 5 },
        { code: 'FILTER_INVOICE_PAYMENT_TERMS', name: 'Payment Terms', sortOrder: 6 },
      ],
    },

    {
      code: 'PRIVILEGE_MGMT', name: 'Privilege Management', icon: 'shield', sortOrder: 90,
      forms: [],
      actions: [
        { code: 'PRIVILEGE.MANAGE', name: 'Manage Roles & Permissions' },
        { code: 'PRIVILEGE.AUDIT_VIEW', name: 'View Audit Log' },
        { code: 'PRIVILEGE.PREVIEW_AS_USER', name: 'Preview as Another User' },
        { code: 'PRIVILEGE.TEMPLATE_MANAGE', name: 'Manage Templates' },
        { code: 'PRIVILEGE.APPROVAL_HANDLE', name: 'Approve / Reject Requests' },
      ],
      bulkActions: [],
      transitions: [],
      scopes: [],
      listColumns: [],
      listFilters: [],
    },

    {
      code: 'USER_MGMT', name: 'User Management', icon: 'user-cog', sortOrder: 91,
      forms: [{
        code: 'USER_FORM', name: 'User',
        sections: [
          { code: 'USER_BASIC', name: 'Basic', fields: [
            { code: 'USER_FULL_NAME', name: 'Full Name', dataType: 'TEXT', defaultRequired: true },
            { code: 'USER_EMAIL', name: 'Email', dataType: 'EMAIL', defaultRequired: true, isPii: true },
            { code: 'USER_PASSWORD', name: 'Password', dataType: 'TEXT', defaultRequired: true },
            { code: 'USER_ACTIVE', name: 'Active', dataType: 'TEXT' },
          ]},
          { code: 'USER_ORG', name: 'Organisation', fields: [
            { code: 'USER_TEAM', name: 'Team', dataType: 'SELECT' },
            { code: 'USER_BRANCH', name: 'Branch', dataType: 'SELECT' },
            { code: 'USER_DEPARTMENT', name: 'Department', dataType: 'SELECT' },
            { code: 'USER_MANAGER', name: 'Manager', dataType: 'SELECT' },
          ]},
        ],
        buttons: [
          { code: 'BTN_USER_SAVE', name: 'Save', variant: 'primary' },
          { code: 'BTN_USER_DEACTIVATE', name: 'Deactivate', variant: 'destructive' },
          { code: 'BTN_USER_RESET_PASSWORD', name: 'Reset Password', variant: 'default' },
        ],
      }],
      actions: [
        { code: 'USER.LIST', name: 'List Users' },
        { code: 'USER.CREATE', name: 'Create User' },
        { code: 'USER.EDIT', name: 'Edit User' },
        { code: 'USER.DEACTIVATE', name: 'Deactivate User', isHighRisk: true },
        { code: 'USER.RESET_PASSWORD', name: 'Reset User Password' },
      ],
      bulkActions: [],
      transitions: [],
      scopes: [],
      listColumns: [],
      listFilters: [],
    },
  ],

  reports: [
    { code: 'RPT_INVOICE_AGING', name: 'Invoice Aging Report', category: 'Finance', description: 'Outstanding invoices grouped by aging buckets' },
    { code: 'RPT_REVENUE_SUMMARY', name: 'Revenue Summary', category: 'Finance', description: 'Monthly/quarterly revenue breakdown' },
    { code: 'RPT_TAX_LIABILITY', name: 'Tax Liability Report', category: 'Finance', description: 'CGST/SGST/IGST collected over period' },
    { code: 'RPT_CUSTOMER_LIFETIME', name: 'Customer Lifetime Value', category: 'CRM' },
    { code: 'RPT_TOP_CUSTOMERS', name: 'Top Customers by Revenue', category: 'CRM' },
    { code: 'RPT_TOP_PRODUCTS', name: 'Top Selling Products', category: 'Sales' },
    { code: 'RPT_INVOICE_STATUS', name: 'Invoice Status Distribution', category: 'Operations' },
    { code: 'RPT_USER_ACTIVITY', name: 'User Activity Report', category: 'Admin' },
  ],

  dashboardWidgets: [
    { code: 'WIDGET_REVENUE_MTD', name: 'Revenue (Month to Date)' },
    { code: 'WIDGET_REVENUE_YTD', name: 'Revenue (Year to Date)' },
    { code: 'WIDGET_OUTSTANDING', name: 'Outstanding Receivables' },
    { code: 'WIDGET_OVERDUE_COUNT', name: 'Overdue Invoice Count' },
    { code: 'WIDGET_TOP_CUSTOMERS', name: 'Top 5 Customers' },
    { code: 'WIDGET_RECENT_INVOICES', name: 'Recent Invoices' },
    { code: 'WIDGET_INVOICES_BY_STATUS', name: 'Invoices by Status (chart)' },
    { code: 'WIDGET_REVENUE_TREND', name: 'Revenue Trend (12-month)' },
    { code: 'WIDGET_TAX_COLLECTED_MTD', name: 'Tax Collected (MTD)' },
    { code: 'WIDGET_PENDING_APPROVALS', name: 'My Pending Approvals' },
  ],
};
