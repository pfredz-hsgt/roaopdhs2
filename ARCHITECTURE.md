# PIMS - Technical Architecture Overview

## 1. System Overview

PIMS (Pharmacy Inventory Management System) is a serverless, modern online web application designed for the Emergency Pharmacy Hospital Segamat. The system facilitates inventory management, drug locating, indent requesting (internal ordering), and expiring drug tracking. It is designed to be lightweight, responsive, and real-time.

The application leverages a Single Page Application (SPA) strategy on the client side, interacting with a Backend-as-a-Service (BaaS) for data persistence, real-time synchronization, and authentication.

## 2. Technology Stack

### Frontend
- **Framework**: React 18
- **Build Tool / Bundler**: Vite
- **UI Component Library**: Ant Design 5.x (with custom theme configuration via `ConfigProvider`)
- **Routing**: React Router v6
- **Styling**: Vanilla CSS (`style.css`), Ant Design tokens, and Inline Styles
- **PDF Generation**: `jspdf` and `jspdf-autotable`
- **Excel/Data Export**: `xlsx`

### Backend (BaaS)
- **Platform**: Supabase
- **Database**: PostgreSQL
- **Authentication**: Supabase Auth (Email/Password)
- **Storage**: Supabase Storage (for drug imagery)
- **Real-time**: Supabase Realtime subscriptions (WebSockets)

## 3. Application Architecture

The application follows a standard React component-based architecture organized logically by feature modules.

### Directory Structure & Intent
```
src/
├── components/   # Reusable UI components (e.g., MainLayout, generic DrugCard)
├── contexts/     # Application-wide React Context providers (e.g., AuthContext)
├── lib/          # Core utilities and backend config (e.g., supabase.js)
├── pages/        # Route-level components grouped by major modules (Auth, Admin, Indent, Cart, etc.)
├── App.jsx       # Root component, Routing definition, Global Providers
└── main.jsx      # React mounting and strict mode
```

### State Management
- **Local UI State**: Managed via `useState` and `useReducer` inside individual components.
- **Global Auth & User State**: Managed by standard Context API (`AuthContext`). It syncs user sessions using `supabase.auth.onAuthStateChange` and queries an extended user profile (to determine `isIssuer` / `isIndenter` flags for Role-Based Access Control).

### Routing and Access Control
Routing is controlled purely on the client via `react-router-dom`. Routes are protected by a `ProtectedRoute` wrapper component:
1. **Public Routes**: Such as `/login` or `/reset-password`.
2. **Protected Routes (Indenter)**: General endpoints like `/home`, `/indent`, `/routine-indent`, `/shortexp`. Require user to be authenticated.
3. **Issuer-Only Routes**: Privileged endpoints like `/cart`, `/indent-list`, and `/admin`. Accessible only if the user profile role is set to "Issuer". Non-issuers are redirected back to the root page.

## 4. Key Functional Modules

1. **Authentication & Identity (`/pages/Auth`)**:
   - Handles login logic connecting to Supabase Auth.
   - Extended by `profiles` database table mapping `auth.users.id` to specific application roles (Issuer vs. Indenter).

2. **Indent Management (`/pages/Indent`)**:
   - Enables users to browse inventory items.
   - Provides mechanisms like shopping carts to aggregate indent requests (`RoutineIndentPage`, `IndentPage`).
   
3. **Cart & Processing (`/pages/Cart`)**:
   - Contains tools for Issuers to process, approve, adjust quantities, or fulfill pending indent requests.
   - `IndentRecordPage` allows users to view a historical ledger of requests.

4. **Inventory & System Administration (`/pages/Admin`)**:
   - Protected portal for full CRUD (Create, Read, Update, Delete) operations on inventory items.
   - Capable of uploading reference images to Supabase Storage.

5. **Short Expiry Module (`/pages/Shortexp`)**:
   - Dedicated user interface to query items mapped as `is_short_exp` or expiring before an assigned threshold.

## 5. Database Architecture

The backend utilizes PostgreSQL via Supabase. Interaction is mostly direct from the React frontend utilizing PostgREST (provided by the `@supabase/supabase-js` library client).

### Core Tables

1. **`inventory_items`**
   - The master catalog for drugs and supplies.
   - **Fields include**: `id` (UUID), `name`, `item_code`, `pku`, `puchase_type` (LP or APPL), `balance` (current stock), `max_qty`, `indent_source`, and metadata for location tracking (e.g., `row`, `std_kt`).
   - Extension columns for tracking expiry (`is_short_exp`, `short_exp`).

2. **`indent_requests`**
   - Represents items added to the cart and standard indent processing.
   - **Relationships**: `item_id` foreign-keys to `inventory_items(id)` with `ON DELETE CASCADE`.
   - **Fields include**: `requested_qty`, `status` (Enum: Pending, Approved, Completed).

3. **`profiles`**
   - *(Managed alongside Supabase Auth)* stores operational metadata per user such as their system role (`Issuer` or `Indenter`).

### Security and Validation
- **Row Level Security (RLS)**: PostgreSQL RLS policies restrict read/write access based on the current authenticated user session context (although public data may be opened per business requirements).
- **Triggers**: PostgreSQL triggers (`update_updated_at_column`) automatically manage timestamp integrity upon row mutations.
- **Constraints**: Utilization of `CHECK` constraints (e.g. `puchase_type IN ('LP', 'APPL')` or `status IN ('Pending', 'Approved', 'Completed')`) to ensure data hygiene at the ORM/DB level.

## 6. Integration and Deployment
- **Environment Management**: Configuration parameters like `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` inject backend references at build time.
- **Real-time Sync**: Free-tier socket subscriptions are utilized on certain pages for immediate cross-client synchronization minimizing polling overhead.
