const { logger } = require('../utils/logger');

const setupSocketIO = (io) => {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Join organization room
    socket.on('join-organization', (organizationId) => {
      socket.join(`org-${organizationId}`);
      logger.info(`Client ${socket.id} joined organization ${organizationId}`);
    });

    // Leave organization room
    socket.on('leave-organization', (organizationId) => {
      socket.leave(`org-${organizationId}`);
      logger.info(`Client ${socket.id} left organization ${organizationId}`);
    });

    // Handle pipeline updates
    socket.on('subscribe-pipeline', (pipelineId) => {
      socket.join(`pipeline-${pipelineId}`);
      logger.info(`Client ${socket.id} subscribed to pipeline ${pipelineId}`);
    });

    socket.on('unsubscribe-pipeline', (pipelineId) => {
      socket.leave(`pipeline-${pipelineId}`);
      logger.info(`Client ${socket.id} unsubscribed from pipeline ${pipelineId}`);
    });

    // Handle build updates
    socket.on('subscribe-build', (buildId) => {
      socket.join(`build-${buildId}`);
      logger.info(`Client ${socket.id} subscribed to build ${buildId}`);
    });

    socket.on('unsubscribe-build', (buildId) => {
      socket.leave(`build-${buildId}`);
      logger.info(`Client ${socket.id} unsubscribed from build ${buildId}`);
    });

    // Handle deployment updates
    socket.on('subscribe-deployment', (deploymentId) => {
      socket.join(`deployment-${deploymentId}`);
      logger.info(`Client ${socket.id} subscribed to deployment ${deploymentId}`);
    });

    socket.on('unsubscribe-deployment', (deploymentId) => {
      socket.leave(`deployment-${deploymentId}`);
      logger.info(`Client ${socket.id} unsubscribed from deployment ${deploymentId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Make io available globally for other services
  global.io = io;
};

// Helper functions to emit events
const emitToOrganization = (organizationId, event, data) => {
  if (global.io) {
    global.io.to(`org-${organizationId}`).emit(event, data);
    logger.debug(`Emitted ${event} to organization ${organizationId}`);
  }
};

const emitToPipeline = (pipelineId, event, data) => {
  if (global.io) {
    global.io.to(`pipeline-${pipelineId}`).emit(event, data);
    logger.debug(`Emitted ${event} to pipeline ${pipelineId}`);
  }
};

const emitToBuild = (buildId, event, data) => {
  if (global.io) {
    global.io.to(`build-${buildId}`).emit(event, data);
    logger.debug(`Emitted ${event} to build ${buildId}`);
  }
};

const emitToDeployment = (deploymentId, event, data) => {
  if (global.io) {
    global.io.to(`deployment-${deploymentId}`).emit(event, data);
    logger.debug(`Emitted ${event} to deployment ${deploymentId}`);
  }
};

const emitToAll = (event, data) => {
  if (global.io) {
    global.io.emit(event, data);
    logger.debug(`Emitted ${event} to all clients`);
  }
};

module.exports = {
  setupSocketIO,
  emitToOrganization,
  emitToPipeline,
  emitToBuild,
  emitToDeployment,
  emitToAll
}; 