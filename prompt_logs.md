# CI/CD Dashboard — AI Prompt Log (v3)

A consolidated, well‑structured log of AI prompts  for the **CI/CD Dashboard** project. Prompts are grouped by lifecycle stage. Items originally placed out of order have been moved to their appropriate sections for clarity.

---

## Stage 1: Initial Planning & Design

### Prompts

* Create a comprehensive CI/CD Dashboard project with requirement analysis, technical design, complete source code, Docker containerization, and documentation.
* Create a detailed technical design document with high‑level architecture, API structure, database schema, UI layout design, and technology stack implementation details.
* Explain the codebase and give me a comprehensive analysis of the entire codebase.
* Fix the login page — it's currently a placeholder with no authentication logic or form.
* Add a **Register** button/page to allow user signup from the UI.
* The frontend is showing a static or blank login page with no interactivity or progress.

---

## Stage 2: Backend Development

### Prompts

* Implement the backend API with Express.js server setup, authentication system, database models, API routes for pipelines/builds/deployments/alerts, error handling, and real‑time updates.
* Implement the database schema with all tables and relationships, migrations, indexes for performance, and PostgreSQL connection configuration.
* Fix the backend **health** endpoint — it's returning **404** instead of **200 OK**.
* Backend `notFound` middleware needs to return correct status codes.
* Fix Prisma/OpenSSL incompatibility — switch backend Docker image(s) to Debian (`node:18-bullseye`).
* Add `postinstall` script to backend `package.json` so `prisma generate` always runs after `npm install`.
* Fix **429** rate‑limiting errors by gating the backend rate limiter behind the `ENABLE_RATE_LIMIT` env flag.

---

## Stage 3: Frontend Development

### Prompts

* Build the React frontend with modern components, responsive design, state management, dashboard widgets for pipeline status and build metrics, real‑time updates, and charts/visualizations.
* Fix TypeScript error: `Property 'env' does not exist on type 'ImportMeta'` — add `vite-env.d.ts`.
* Frontend build failed due to TypeScript/Vite env typing issues — resolve typing + config.
* Install missing Material Icons package: `@mui/icons-material` inside the frontend container.
* Fix TypeScript errors in `Builds.tsx` and `Pipelines.tsx` so the frontend build passes.
* Visually refine the Dashboard: add polish/animations, graphical metrics, and build logs.
* Add real‑time metrics (success/failure rate, build time, last build status) and a build logs display.
* Dashboard **Visible integrations** should use a `ToggleButtonGroup` that is session‑only and does **not** persist changes.
* Add backend + frontend support to fetch and display **GitHub Actions run logs** in the Dashboard.

---

## Stage 4: Integration & Features

### Prompts

* Implement integrations with CI/CD platforms including **GitHub Actions**, **GitLab CI**, **Jenkins** (REST API), webhook handlers, and data synchronization services.
* Implement the alerting system with alert configuration management, multi‑channel notifications, alert rules and conditions, alert history tracking, and escalation mechanisms.
* **GitHub integration should work the same way as Jenkins** — full backend, frontend, and UI management for GitHub Actions pipelines/builds/deployments.
* Fix Prisma schema relation error for **GitHubIntegration/Organization** — update schema and rebuild backend.
* **Settings** page should include GitHub integration management UI — create, list, activate, delete integrations.
* All main pages should detect the active provider and display **GitHub Actions** data if **Jenkins** is not configured.
* Dashboard and other pages should show **both Jenkins and GitHub** data simultaneously when both are configured.
* Add **provider differentiation** and **integration names** in section headers for clarity.
* Add **provider tabs/toggles** for multi‑provider selection on the **Pipelines details** page.
* Dashboard should display **GitHub Actions summary** (success rate, counts) similar to Jenkins.
* Add ability to **edit existing integrations** from the Settings page with edit dialogs and update logic.
* Support **multiple integrations of the same type** being active at the same time.
* Remove alerting integration (Slack/Email) and Mailpit due to instability — set `ALERTS_ENABLED=false`.
* Remove Mailpit and all dev‑only alerting configs from the codebase and Docker Compose files.

---

## Stage 5: Containerization & Deployment

### Prompts

* Containerize the application with Dockerfiles for backend and frontend, `docker-compose` configuration for the entire stack, environment variable configuration, and production‑ready container setup.

---

## Stage 6: Testing & Quality

### Prompts

* Ask AI to check code quality and remove unnecessary variables and functions.

---

## Stage 7: Documentation & Polish

### Prompts

* Create comprehensive documentation with detailed **README**, architecture overview, API documentation with examples, deployment guide, troubleshooting section, and AI usage documentation.
* Create detailed API documentation with **OpenAPI/Swagger** specification, endpoint descriptions with examples, authentication documentation, error code explanations, and rate limiting information.

---

## Stage 8: Production Readiness — Prompts (v3)

### Prompts

* **Use one `docker-compose.yml` for everything.**

* **Set up the database automatically on first start.**

* **Start order should be: database → backend → frontend.**

* **Frontend should wait until backend is ready.**

* **Start with no data — no users or integrations by default. Don't auto‑add demo/sample data. Ensure zero‑integration, zero‑user initial state.**

* **Keep environment variables minimal and accurate. Remove unused variables and seed scripts from env files.**

* **Make frontend and backend talk locally without CORS issues.**

* **Create a v3 branch, push it, clone fresh, run compose, and verify logs.**

* **Swagger docs should open at `/api-docs`; if blocked in prod, give me a switch.**

* **Align the docs with reality — note the flags and actual stack.**

* **Apply production readiness recommendations: secrets to env, safer defaults in compose, enable rate limiting, add restart policy, healthchecks.**

* **Automate Prisma migrations on backend container startup.**

* **Don't run the commands in bulk… current issue is frontend/backend deployed before DB.**

* **Store DB data with the schema… no users for start and no integrations.**
