# PIMS - Pharmacy Inventory Management System
## System Functionality & Architecture Overview

PIMS (Pharmacy Inventory Management System) is an inventory, indent tracking, and drug locator application designed for the Emergency Pharmacy Hospital Segamat. The system leverages a modern serverless Single Page Application (SPA) strategy.

**Tech Stack**:
- **Frontend**: React 18, Vite, React Router v6
- **UI Framework**: Ant Design 5.x with custom theming
- **Backend**: Supabase (PostgreSQL Database, Authentication, Storage, Real-time WebSockets)
- **Data Export**: `jspdf`, `jspdf-autotable`, `xlsx`

### Core Functionality Modules:
1. **Authentication & Identity**: Based on Supabase Auth. Differentiates user sessions between `Issuer` (Admin/Pharmacist) and `Indenter` (Staff requesting supplies).
2. **Drug Locator & Home**: Public or protected catalog access allowing users to search drugs by name, type, and location, featuring grid/list views and details.
3. **Indent Management** (`/indent`, `/routine-indent`): Mechanism for indenter staff to browse items, filter by pharmacy sections, and add items to a request "cart".
4. **Cart & Approval Processing** (`/cart`, `/indent-list`): Interface for Issuers to review aggregated indent requests (by source: IPD, OPD, MFG), adjust quantities, and approve/complete them. Generates print-friendly records.
5. **Short Expiry Module** (`/shortexp`): Tracks and displays drugs nearing their expiration dates for rapid identification.
6. **Administration** (`/admin`): CRUD interfaces for updating the main inventory records, adjusting stock bounds, managing locations, and uploading images to Supabase Storage.

---

## Data Structure (Database Schema)

The backend relies on a PostgreSQL relational database managed via Supabase PostgREST endpoints.

### 1. `inventory_items` (Master Catalog)
Tracks physical inventory and mapping details.
- `id` (UUID): Primary Key
- `name` (String): Item/Drug Name
- `item_code` / `pku` (String): Identifiers
- `puchase_type` (String): 'LP' or 'APPL'
- `balance`, `min_qty`, `max_qty` (Integer): Stock limits and current levels
- `type` (String): Category (Tablet, Injection, Syrup, etc.)
- `section`, `row`, `bin`, `location_code` (String): Exact shelf location mappings
- `indent_source` (String): Origination tag (IPD, OPD, MFG)
- `is_short_exp` (Boolean) & `short_exp` (Date): Expiration tracking
- `image_url` (String): Link to drug photo in Supabase Storage

### 2. `indent_requests` (Transactional Flow)
Tracks cart items and indent history.
- `id` (UUID): Primary Key
- `item_id` (UUID): Foreign Key -> `inventory_items.id`
- `requested_qty` (Integer): Requested amount
- `status` (Enum): 'Pending', 'Approved', 'Completed'

### 3. `profiles` (User Management)
Coupled with `auth.users` to handle Role-Based Access Control (RBAC).
- Maps the user ID to a role, specifically designating flags like `isIssuer` versus standard indenters.

---

## Current UI / UX Design

The user interface heavily revolves around the **Ant Design (antd 5.x)** component library and leans towards functional, utilitarian administrative dashboards.

### Visual Architecture & Layout
- **Global Layout**: Guided by the `MainLayout.jsx` wrapper, it predominantly uses a collapsible Sidebar/Sider for global navigation and a Header containing user session data.
- **Routing & Navigation**: The navigation menu is dynamically rendered based on the logged-in user's role. Issuers see "Cart", "Indent Record", and "Admin" tabs which are hidden from standard Indenters.
- **Theme**: It uses Ant Design's standard algorithm (configured via `ConfigProvider`) with a primary color accent (`#1890ff`, blue) and rounded borders (`borderRadius: 6`).

### Component Usage & User Experience
- **Forms and Modals**: Intensive use of Ant Design modals for Data Entry (e.g., `IndentModal`, `DrugDetailModal`). Interactions are typically pop-up driven instead of multi-step page navigations.
- **Data Display**: Relies on Ant Design Tables (for Admin CRUD and Cart records) with built-in pagination, sorting, and inline editing.
- **Grids & Lists**: The "Drug Locator" section relies on repetitive customized `DrugCard` components rendered in Flexbox/Grid layouts, allowing users to toggle between concise list rows and more visual image-led cards.
- **Feedback & Loading State**: Loading spin states (`<Spin />`) and notification popups are hooked into real-time server responses.
- **Responsiveness**: Utilizes standard CSS and Ant grid systems to manage responsiveness, primarily targeting desktop viewing but scaling adequately for mobile locator querying.

### Areas for UI Revamp Opportunity
As an internal administrative tool, the overall aesthetic is functional but "standard". A UI/UX revamp could push:
- **Dashboarding**: Adding charting and analytic views for inventory expenditure over time.
- **Micro-interactions**: Improving the "Add to Cart" flow to be more seamless and less click-intensive than Modal confirmations.
- **Modernization**: Upgrading from default Ant Design styling to a custom, more cohesive, modern "glassmorphic" or sophisticated flat-design aesthetic using Tailwind or enhanced CSS tokens.
- **Mobile First Cart**: Optimizing the Indent/Cart process explicitly for mobile devices if staff are operating on tablets/phones while walking the ward.
