# CI/CD Dashboard

A comprehensive dashboard for monitoring and managing Continuous Integration and Continuous Deployment pipelines across multiple platforms.

## 🚀 Features

- **Real-time Pipeline Monitoring**: Live status tracking of CI/CD pipelines
- **Multi-Platform Support**: Implemented — GitHub Actions, Jenkins; Roadmap — GitLab CI, Azure DevOps
- **Build & Deployment Tracking**: Comprehensive build and deployment history
- **Alerting System**: Configurable alerts with multi-channel notifications
- **Performance Analytics**: Detailed metrics and trend analysis
- **Responsive Dashboard**: Modern, mobile-friendly interface
- **Role-based Access Control**: Different views for developers, DevOps, and managers

## 🏗️ Architecture

### System Overview
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

### Technology Stack

#### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Database**: PostgreSQL 15 with Prisma ORM
- **Cache**: Redis 7
- **Authentication**: JWT (custom middleware)
- **Real-time**: Socket.io
- **Documentation**: Swagger/OpenAPI

#### Frontend
- **Framework**: React 18 with TypeScript
- **State Management**: Redux Toolkit
- **UI Framework**: Material-UI (MUI)
- **Charts**: Recharts
- **Build Tool**: Vite
- **Real-time**: Socket.io Client

#### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx (optional)
- **Monitoring**: Health checks and logging

## 📋 Prerequisites

- Node.js 18 or higher
- Docker and Docker Compose
- PostgreSQL 15 (if running locally)
- Redis 7 (if running locally)

## 🛠️ Installation & Setup

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ci-cd-dashboard.git
   cd ci-cd-dashboard
   ```

2. **Configure environment variables**
   ```bash
   cp backend/env.example backend/.env
   # Edit backend/.env with your configuration
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - API Documentation: http://localhost:5000/api-docs

### Option 2: Local Development

1. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp env.example .env
   # Edit .env with your configuration
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

2. **Setup Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Setup Database**
   ```bash
   # Install PostgreSQL and Redis
   # Update DATABASE_URL and REDIS_URL in backend/.env
   ```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
# Server Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
ENABLE_SWAGGER=false          # enable docs locally by setting true
ENABLE_RATE_LIMIT=false       # enable global rate limiting on /api when true
ALERTS_ENABLED=true           # disable alert scheduler by setting false

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/cicd_dashboard"

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=30d

# Redis Configuration
REDIS_URL=redis://localhost:6379

# External Integrations
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_WS_URL=ws://localhost:5000
```

### Database Setup

1. **Run migrations**
   ```bash
   cd backend
   npm run db:migrate
   ```

2. **Seed initial data**
   ```bash
   npm run db:seed
   ```

3. **View database (optional)**
   ```bash
   npm run db:studio
   ```

## 📚 API Documentation

The API documentation is available at `http://localhost:5000/api-docs` when `ENABLE_SWAGGER=true` or when not running in production (`NODE_ENV !== 'production'`).

Production guidance:
- Set `ENABLE_SWAGGER=false` (default) in production.
- Keep API docs disabled unless explicitly required for troubleshooting.

### Key Endpoints

#### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `GET /api/v1/auth/profile` - Get user profile

#### Pipelines
- `GET /api/v1/pipelines` - List pipelines
- `POST /api/v1/pipelines` - Create pipeline
- `GET /api/v1/pipelines/:id` - Get pipeline details
- `PUT /api/v1/pipelines/:id` - Update pipeline
- `DELETE /api/v1/pipelines/:id` - Delete pipeline

#### Builds
- `GET /api/v1/builds` - List builds
- `GET /api/v1/builds/:id` - Get build details
- `GET /api/v1/builds/metrics` - Get build metrics

#### Deployments
- `GET /api/v1/deployments` - List deployments
- `GET /api/v1/deployments/:id` - Get deployment details
- `GET /api/v1/deployments/metrics` - Get deployment metrics

#### Alerts
- `GET /api/v1/alerts` - List alerts
- `POST /api/v1/alerts` - Create alert
- `GET /api/v1/alerts/history` - Get alert history

#### Dashboard
- `GET /api/v1/dashboard/data` - Get dashboard overview
- `GET /api/v1/dashboard/widgets` - Get dashboard widgets

## 🤖 AI Tools Usage

This project was developed with extensive use of AI tools. Here's how they were utilized:

### 1. Requirement Analysis
**Tool**: Cursor AI Assistant
**Usage**: Analyzed project requirements and created comprehensive requirement analysis document covering:
- Key features and functionality
- Technical choices and rationale
- APIs and tools required
- Security and performance requirements

### 2. Technical Design
**Tool**: Cursor AI Assistant
**Usage**: Created detailed technical design document including:
- High-level architecture with component diagrams
- Complete API structure with endpoints and sample responses
- Database schema with all tables and relationships
- UI layout design with responsive considerations

### 3. Backend Development
**Tool**: Cursor AI Assistant
**Usage**: Generated backend code including:
- Express.js server setup with proper middleware
- Authentication system using JWT
- Database models using Prisma ORM
- API routes for all entities
- Error handling and validation middleware
- Real-time updates using Socket.io

### 4. Frontend Development
**Tool**: Cursor AI Assistant
**Usage**: Created React frontend including:
- Modern React 18 components with TypeScript
- Material-UI based responsive design
- Redux Toolkit for state management
- Dashboard widgets and visualizations
- Real-time updates using Socket.io client

### 5. Database Design
**Tool**: Cursor AI Assistant
**Usage**: Designed database schema including:
- Prisma schema with all tables and relationships
- Database migrations
- Performance optimization with indexes
- Connection configuration

### 6. Containerization
**Tool**: Cursor AI Assistant
**Usage**: Created Docker configuration including:
- Multi-stage Dockerfiles for both frontend and backend
- Docker Compose for full stack deployment
- Environment variable configuration
- Health checks and monitoring

### Key Learnings from AI Usage

1. **Architecture Design**: AI helped identify the need for microservices architecture early in the design phase
2. **Technology Stack**: AI suggested modern, well-supported technologies that work well together
3. **Database Design**: AI helped design normalized database schema with proper relationships
4. **Security Implementation**: AI identified security considerations that might have been overlooked
5. **Testing Strategy**: AI suggested comprehensive testing approach covering all layers

### Best Practices Discovered

1. **Prompt Engineering**: Be specific, provide context, ask for rationale, and iterate
2. **Code Generation**: Always review generated code, customize for context, and test thoroughly
3. **Documentation**: Use AI for structure, add project-specific details, and keep updated

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
npm run test:watch
```

### Frontend Testing
```bash
cd frontend
npm test
npm run test:ui
```

## 🚀 Deployment

### Production Deployment

1. **Build and deploy with Docker**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Environment-specific configuration**
   - Update environment variables for production
   - Configure SSL certificates
   - Set up monitoring and logging

3. **Database migration**
   ```bash
   docker-compose exec backend npm run db:migrate
   ```

### Cloud Deployment

The application can be deployed to various cloud platforms:

- **AWS**: Using ECS, EKS, or EC2
- **Azure**: Using Azure Container Instances or AKS
- **GCP**: Using Cloud Run or GKE
- **Heroku**: Using container deployment

## 📊 Monitoring & Logging

### Health Checks
- Backend: `GET /health`
- Database: Connection monitoring
- Redis: Connection monitoring

### Logging
- Backend logs: Winston logger with file and console output
- Frontend logs: Browser console and error tracking
- Docker logs: Container-level logging

### Metrics
- Build success rates
- Deployment frequency
- Response times
- Error rates

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Token refresh mechanism

### API Security
- Rate limiting
- Input validation
- CORS configuration
- Helmet.js security headers

### Data Protection
- HTTPS enforcement
- Database encryption
- Secure environment variables
- Audit logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the [API documentation](http://localhost:5000/api-docs)
- Review the [troubleshooting guide](docs/troubleshooting.md)

## 🔄 Roadmap

- [ ] Additional CI/CD platform integrations
- [ ] Advanced analytics and reporting
- [ ] Mobile application
- [ ] Multi-tenant support
- [ ] Advanced alerting rules
- [ ] Performance optimization
- [ ] Integration with monitoring tools (Prometheus, Grafana)

## ⚙️ First-Run Automation (v3)

The backend automates database setup on container startup via `backend/entrypoint.sh`:

- Prisma migrations: `prisma migrate deploy` (with retry)
- Schema sync: `prisma db push` (post-deploy drift catch)
- Prisma client: `prisma generate`
- Seed (idempotent): runs `backend/src/scripts/seed.js` when `SEED_ON_START=true`

Environment variables in `docker-compose.yml` control seeding and defaults:

- `ADMIN_EMAIL` (e.g., `admin@example.com`)
- `ADMIN_PASSWORD` (e.g., `ChangeMe123!`)
- `SEED_ON_START=true` to enable seeding on boot
- `SEED_SAMPLES=true` to include demo pipeline/build/deployment/alert data
- `FRONTEND_URL=http://localhost:3000`
- `ENABLE_SWAGGER=true` to expose Swagger UI at `/api-docs` in local setups
  - Recommended to leave disabled in production (`ENABLE_SWAGGER=false`).

Quick start (Docker Compose):

- Bring up: `docker compose up -d`
- Frontend: http://localhost:3000
- API base: http://localhost:5000/api/v1

Notes:

- Seeding is safe to run multiple times (upserts). For production, disable after first boot by setting `SEED_ON_START=false`.
- Admin credentials are configurable via env; change defaults immediately.

---

**Built with ❤️ using AI-assisted development**