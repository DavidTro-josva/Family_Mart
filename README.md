# Family Mart ERP - Enterprise Retail Suite

Family Mart ERP is a production-grade, enterprise-ready Enterprise Resource Planning system designed for modern retail store management and logistics. 

It is structured as a monorepo containing a high-performance **Express.js API** (backend) and a premium **React (Vite) Single Page Application** (frontend).

---

## Technical Stack

- **Frontend**: React, Tailwind CSS, TanStack Query (React Query), Axios, React Router, Lucide Icons.
- **Backend**: Node.js, Express, Prisma ORM, PostgreSQL, JWT Authentication (with silent HttpOnly cookie refresh), Zod Validation, Winston Logger, OpenAPI/Swagger.
- **Deployment**: Docker, Docker Compose.

---

## Core Capabilities & Modules

### 1. Core Retail Operations (Phase 1)
- **Role-Based Access Control (RBAC)**: Custom routing and permissions for `ADMIN`, `MANAGER`, `CASHIER`, and `INVENTORY_CLERK`.
- **Master Data Management**: Unified CRUD dashboards for products, suppliers, customers, and employees.
- **POS & Billing Terminal**: Barcode scanning, cart management, and 80mm thermal receipt printing layouts.
- **Cash Register Shift Control**: Drawer shift management (opening float, drops, petty cash, actual cash reconciliation, and variances).
- **Customer Credit Ledger**: Credit checkouts, payment postings, and chronological outstanding balance ledgers.
- **Real-Time Live Dashboard**: Real-time sales trend curves, payment distributions, and transaction feeds.
- **System Audit Logs**: Immutable audit log terminal capturing all security and business events.

### 2. Advanced Logistics & Financial Accounting (Phase 2)
- **Procurement Management**: Purchase Orders (POs) with cost calculations and manager approval workflows.
- **Goods Receipt (GRN) & Quality Control**: Warehouse intake checklists with item-level inspection statuses (Passed, Failed, Quarantine, Damaged, Expired) and bin code assignments.
- **FIFO Costing Engine**: Automatic FIFO inventory valuation layer tracking and COGS calculations.
- **Stock Transfers**: Multi-warehouse transfers (STR, GIN dispatch, and GRN receipt) with cost layer preservation.
- **Customer Returns & RMA**: Return Merchandise Authorization workflows with quality inspections, scrap routing, and cash register cash-out integrations.
- **Three-Way Match Verification**: Matching POs (ordered prices) vs GRNs (received quantities) vs Supplier Invoices (billed prices/quantities) with manager overrides.
- **Accounts Payable (AP)**: Supplier ledger statements, payment vouchers, and 30/60/90 days aging.
- **GST Tax Filings (GSTR-1/GSTR-2)**: Rate-wise GST collected (sales) vs GST paid (purchases / ITC) summaries.

### 3. Business Intelligence & Decision Support (Phase 3)
- **Executive BI Dashboard**: Today's and MTD sales, gross profits, margins, and net working capital with period-over-period trend indicators (Today vs Yesterday, MTD vs LMTD).
- **Inventory Intelligence**: ABC/XYZ demand matrices, FIFO stock ageing, wastage/expiry risk alerts, and stock velocity tracking.
- **Smart Reorder Advisor**: Automated reorder recommendations with quick-draft PO actions.
- **Smart Alerts Console**: Persistent alerts for low stock, expiring layers, credit breaches, cash variances, and unusual discounts.
- **Universal Search & Event Explorer**: Multi-entity global search and unified chronological activity timelines.

---

## Quick Start with Docker (Recommended)

To launch the entire ERP stack (PostgreSQL database, Express API, and React frontend) in a single command, run:

```bash
docker compose up --build
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- **Interactive Swagger Docs**: [http://localhost:5000/api/v1/docs](http://localhost:5000/api/v1/docs)
- **PostgreSQL Database**: Port `5432`

---

## Seeded Credentials (Testing Roles)

The database is pre-populated with the following user accounts to test different access levels:

| Username | Password | Role | Access Level / Description |
|---|---|---|---|
| `admin` | `Admin@123` | `ADMIN` | Full system access, settings, and audits |
| `manager` | `Manager@123` | `MANAGER` | Full BI dashboards, approvals, and AP |
| `cashier` | `Cashier@123` | `CASHIER` | POS Billing and Cash Register shifts |
| `clerk` | `Clerk@123` | `INVENTORY_CLERK` | Warehouse stock adjustments and GRNs |
