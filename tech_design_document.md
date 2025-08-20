# CI/CD Dashboard - Technical Design Document

## High-Level Architecture

### System Overview
The CI/CD Dashboard follows a microservices architecture with the following components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WebSocket     │    │   Redis Cache   │    │   File Storage  │
│   (Socket.io)   │    │   (Real-time)   │    │   (Logs/Reports)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Component Architecture

#### 1. Frontend Layer
- **Technology**: React 18 with TypeScript
- **State Management**: Redux Toolkit
- **UI Framework**: Material-UI (MUI)
- **Charts**: Recharts for data visualization
- **Real-time**: Socket.io client
- **Build Tool**: Vite

#### 2. Backend Layer
- **Technology**: Node.js with Express.js
- **Authentication**: JWT (custom middleware)
- **API Documentation**: Swagger/OpenAPI
- **Validation**: express-validator
- **Rate Limiting**: express-rate-limit (toggled by `ENABLE_RATE_LIMIT`)
- **CORS**: Configured allowlist with localhost support and `FRONTEND_URL`

#### 3. Data Layer
- **Primary Database**: PostgreSQL 15
- **Cache**: Redis 7
- **ORM**: Prisma
- **Migrations**: Prisma Migrate

#### 4. External Integrations
- **CI/CD Platforms**: GitHub Actions, Jenkins (implemented); GitLab CI/Azure DevOps (roadmap)
- **Notifications**: Slack (Webhook) and Email (SMTP) implemented; Teams/SMS (roadmap)
- **Monitoring**: Prometheus/Grafana (roadmap)

## API Structure

### Base URL
Local development:
```
http://localhost:5000/api/v1
```
Production (example behind reverse proxy):
```
https://api.example.com/api/v1
```

### Authentication Endpoints
```
POST   /auth/login
POST   /auth/register
POST   /auth/refresh
POST   /auth/logout
GET    /auth/profile
```

### Pipeline Management
```
GET    /pipelines                    # List all pipelines
POST   /pipelines                    # Create new pipeline
GET    /pipelines/:id               # Get pipeline details
PUT    /pipelines/:id               # Update pipeline
DELETE /pipelines/:id               # Delete pipeline
GET    /pipelines/:id/builds        # Get pipeline builds
GET    /pipelines/:id/metrics       # Get pipeline metrics
```

### Build Management
```
GET    /builds                      # List all builds
GET    /builds/:id                  # Get build details
GET    /builds/metrics              # Get build metrics
```
Planned (not yet implemented):
```
POST   /builds/:id/retry            # Retry failed build
GET    /builds/:id/logs             # Get build logs
```

### Deployment Management
```
GET    /deployments                 # List all deployments
GET    /deployments/:id             # Get deployment details
GET    /deployments/metrics         # Get deployment metrics
```
Planned (not yet implemented):
```
POST   /deployments/:id/rollback    # Rollback deployment
```

### Alerting System
```
GET    /alerts                      # List all alerts
POST    /alerts                     # Create new alert
PUT    /alerts/:id                  # Update alert
DELETE /alerts/:id                  # Delete alert
GET    /alerts/history              # Get alert history
POST    /alerts/test                # Test alert configuration
```

### Dashboard Widgets
```
GET    /dashboard/data              # Get dashboard data (implemented)
```
Planned (not yet implemented):
```
GET    /dashboard/widgets           # Get dashboard widgets
POST   /dashboard/widgets           # Create new widget
PUT    /dashboard/widgets/:id       # Update widget
DELETE /dashboard/widgets/:id       # Delete widget
```

### Sample API Responses

#### Pipeline Response
```json
{
  "id": "pipeline-123",
  "name": "Frontend CI/CD",
  "platform": "github-actions",
  "repository": "myorg/frontend-app",
  "status": "active",
  "lastBuild": {
    "id": "build-456",
    "status": "success",
    "startedAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:35:00Z",
    "duration": 300
  },
  "metrics": {
    "successRate": 95.2,
    "averageDuration": 280,
    "totalBuilds": 150
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

#### Build Response
```json
{
  "id": "build-456",
  "pipelineId": "pipeline-123",
  "status": "success",
  "triggeredBy": "push",
  "branch": "main",
  "commit": "abc123def456",
  "startedAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:35:00Z",
  "duration": 300,
  "stages": [
    {
      "name": "install",
      "status": "success",
      "duration": 45
    },
    {
      "name": "test",
      "status": "success",
      "duration": 120
    },
    {
      "name": "build",
      "status": "success",
      "duration": 135
    }
  ],
  "artifacts": [
    {
      "name": "dist.zip",
      "size": 2048576,
      "url": "https://storage.example.com/artifacts/dist.zip"
    }
  ]
}
```

## Database Schema

### Core Tables

#### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Organizations
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Pipelines
```sql
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  repository_url VARCHAR(500) NOT NULL,
  repository_id VARCHAR(255),
  config JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Builds
```sql
CREATE TABLE builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id),
  external_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  triggered_by VARCHAR(50) NOT NULL,
  branch VARCHAR(255),
  commit_hash VARCHAR(255),
  commit_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration INTEGER,
  logs_url VARCHAR(500),
  artifacts JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Deployments
```sql
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id),
  build_id UUID REFERENCES builds(id),
  environment VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  deployed_by UUID REFERENCES users(id),
  deployed_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Alerts
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL,
  channels JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Alert History
```sql
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id),
  pipeline_id UUID REFERENCES pipelines(id),
  build_id UUID REFERENCES builds(id),
  user_id UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL,
  message TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes
```sql
-- Performance indexes
CREATE INDEX idx_builds_pipeline_id ON builds(pipeline_id);
CREATE INDEX idx_builds_status ON builds(status);
CREATE INDEX idx_builds_created_at ON builds(created_at);
CREATE INDEX idx_deployments_pipeline_id ON deployments(pipeline_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_alert_history_alert_id ON alert_history(alert_id);
CREATE INDEX idx_alert_history_sent_at ON alert_history(sent_at);
```

## UI Layout Design

### Dashboard Layout Structure

#### 1. Header Section
- **Logo and Navigation**: Company logo, main navigation menu
- **User Profile**: User avatar, dropdown with profile options
- **Quick Actions**: Add pipeline, create alert, settings
- **Search Bar**: Global search for pipelines, builds, deployments

#### 2. Sidebar Navigation
- **Dashboard**: Overview and summary widgets
- **Pipelines**: List and manage all pipelines
- **Builds**: Build history and details
- **Deployments**: Deployment tracking and history
- **Alerts**: Alert configuration and history
- **Analytics**: Performance metrics and reports
- **Settings**: User and organization settings

#### 3. Main Dashboard Area

##### Overview Widgets (Grid Layout)
```
┌─────────────────┬─────────────────┬─────────────────┐
│   Pipeline      │   Build         │   Deployment    │
│   Status        │   Success Rate  │   Frequency     │
└─────────────────┴─────────────────┴─────────────────┘
┌─────────────────┬─────────────────┬─────────────────┐
│   Recent        │   Performance   │   Alert         │
│   Builds        │   Trends        │   Summary       │
└─────────────────┴─────────────────┴─────────────────┘
```

##### Pipeline Status Widget
- **Visual Elements**: 
  - Color-coded status indicators (green=success, red=failure, yellow=running)
  - Progress bars for running builds
  - Quick action buttons (retry, view logs)
- **Data Display**: Pipeline name, last build status, duration, triggered by

##### Build Success Rate Widget
- **Visual Elements**: 
  - Donut chart showing success/failure ratio
  - Trend line for last 30 days
  - Percentage display
- **Data Display**: Success rate, total builds, average duration

##### Recent Builds Widget
- **Visual Elements**: 
  - Timeline view of recent builds
  - Status badges
  - Duration indicators
- **Data Display**: Build ID, status, duration, branch, commit message

#### 4. Detailed Views

##### Pipeline Detail Page
```
┌─────────────────────────────────────────────────────────┐
│ Pipeline Header (Name, Status, Actions)                │
├─────────────────────────────────────────────────────────┤
│ Build History Table                                     │
│ ┌─────────┬─────────┬─────────┬─────────┬─────────────┐ │
│ │ Build   │ Status  │ Branch  │ Duration│ Actions     │ │
│ │ ID      │         │         │         │             │ │
│ └─────────┴─────────┴─────────┴─────────┴─────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Performance Metrics Charts                              │
│ ┌─────────────────┬─────────────────┬─────────────────┐ │
│ │ Success Rate    │ Build Duration  │ Build Frequency │ │
│ │ Trend           │ Trend           │ Trend           │ │
│ └─────────────────┴─────────────────┴─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

##### Build Detail Page
```
┌─────────────────────────────────────────────────────────┐
│ Build Header (ID, Status, Duration, Actions)           │
├─────────────────────────────────────────────────────────┤
│ Build Information                                       │
│ ┌─────────────────┬─────────────────┬─────────────────┐ │
│ │ Trigger Info    │ Commit Details  │ Environment     │ │
│ └─────────────────┴─────────────────┴─────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Build Stages Timeline                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Install] → [Test] → [Build] → [Deploy]            │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Build Logs                                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Log content with syntax highlighting]              │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Responsive Design
- **Mobile First**: Design optimized for mobile devices
- **Breakpoints**: 
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px
- **Grid System**: 12-column responsive grid
- **Touch Friendly**: Large touch targets for mobile users

### Color Scheme
- **Primary**: #1976d2 (Blue)
- **Secondary**: #dc004e (Pink)
- **Success**: #4caf50 (Green)
- **Warning**: #ff9800 (Orange)
- **Error**: #f44336 (Red)
- **Background**: #fafafa (Light Gray)
- **Surface**: #ffffff (White)

### Typography
- **Primary Font**: Roboto (Google Fonts)
- **Monospace Font**: 'Roboto Mono' for logs and code
- **Font Sizes**: 
  - H1: 2.5rem
  - H2: 2rem
  - H3: 1.75rem
  - Body: 1rem
  - Caption: 0.875rem

---

## Implementation Notes (v3)

Added in v3 to capture runtime and deployment specifics.

- Runtime endpoints
  - Backend API base (local): `http://localhost:5000/api/v1`
  - Swagger UI: `http://localhost:5000/api-docs`
- Docker Compose startup
  - Backend entrypoint automates: migrations → db push (drift catch) → prisma generate → idempotent seed
- Seeding controls
  - `SEED_ON_START` (default true) and `SEED_SAMPLES` for demo data
- CORS configuration
  - Allow `FRONTEND_URL` and localhost/127.0.0.1 with dynamic ports
- Alerts
  - Toggle scheduler via `ALERTS_ENABLED` (set false to disable)
- Security
  - Rotate `JWT_SECRET`, change default admin password, disable seeding in production
- API docs flag
  - `ENABLE_SWAGGER=true` to expose Swagger UI locally; keep false in production
- Rate limiting
  - Enable request rate limiting with `ENABLE_RATE_LIMIT=true`
  - Idempotent seed: `backend/src/scripts/seed.js`

### Seeding Controls (env)
- `SEED_ON_START=true` enables seed on boot
- `SEED_SAMPLES=true` adds demo pipeline/build/deployment/alert data
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` configure initial admin

### CORS & Realtime
- `FRONTEND_URL` plus localhost/127.0.0.1 origins allowed in `backend/src/server.js`
- Socket.IO CORS mirrors HTTP CORS

### Security Recommendations
- Rotate `JWT_SECRET`
- Change seeded admin password after first login
- Disable `SEED_ON_START` in production

*This technical design document provides the foundation for implementing the CI/CD Dashboard with modern web technologies and best practices.* 