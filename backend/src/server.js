const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { logger } = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');
const { setupSocketIO } = require('./services/socketService');
const { startAlertScheduler } = require('./services/alertService');
const { connectDatabase } = require('./database/connection');

// Import routes
const authRoutes = require('./routes/auth');
const pipelineRoutes = require('./routes/pipelines');
const buildRoutes = require('./routes/builds');
const deploymentRoutes = require('./routes/deployments');
const alertRoutes = require('./routes/alerts');
const dashboardRoutes = require('./routes/dashboard');
const jenkinsRoutes = require('./routes/jenkins');
const jenkinsConfigsRoutes = require('./routes/jenkinsConfigs');
const githubRoutes = require('./routes/github');
const githubConfigsRoutes = require('./routes/githubConfigs');
const settingsRoutes = require('./routes/settings');

const app = express();
const server = createServer(app);

// Build CORS allowlist
const defaultFrontend = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowlist = new Set([
  defaultFrontend,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
// Helper to check if origin is allowed (allow any 127.0.0.1:<port> for local previews)
function isAllowedOrigin(origin) {
  if (!origin) return true; // non-browser clients
  if (allowlist.has(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  return false;
}

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
    credentials: true,
  }
});

// Trust proxy (needed when running behind reverse proxies/tunnels so rate limiter can read X-Forwarded-For safely)
app.set('trust proxy', 1);

// Rate limiting (optional; enable by setting ENABLE_RATE_LIMIT=true)
const enableRateLimit = process.env.ENABLE_RATE_LIMIT === 'true';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // default production threshold; can be tuned via env if needed
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
if (enableRateLimit) {
  app.use('/api', limiter);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/pipelines', pipelineRoutes);
app.use('/api/v1/builds', buildRoutes);
app.use('/api/v1/deployments', deploymentRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/integrations/jenkins', jenkinsRoutes);
app.use('/api/v1/integrations/jenkins-configs', jenkinsConfigsRoutes);
app.use('/api/v1/integrations/github', githubRoutes);
app.use('/api/v1/integrations/github-configs', githubConfigsRoutes);
app.use('/api/v1/settings', settingsRoutes);

// Swagger documentation
if (process.env.NODE_ENV !== 'production') {
  const swaggerJsdoc = require('swagger-jsdoc');
  const swaggerUi = require('swagger-ui-express');

  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'CI/CD Dashboard API',
        version: '1.0.0',
        description: 'API documentation for CI/CD Dashboard',
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT || 5000}/api/v1`,
          description: 'Development server',
        },
      ],
    },
    apis: ['./src/routes/*.js'],
  };

  const specs = swaggerJsdoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Setup Socket.IO
setupSocketIO(io);

// Database connection
connectDatabase();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
  }
  // Start alerts scheduler unless explicitly disabled
  if ((process.env.ALERTS_ENABLED || 'true') !== 'false') {
    startAlertScheduler();
  } else {
    logger.info('Alerts scheduler disabled by ALERTS_ENABLED=false');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

module.exports = { app, server, io }; 