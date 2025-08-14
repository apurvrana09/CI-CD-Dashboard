import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import pipelineReducer from './slices/pipelineSlice';
import buildReducer from './slices/buildSlice';
import deploymentReducer from './slices/deploymentSlice';
import alertReducer from './slices/alertSlice';
import dashboardReducer from './slices/dashboardSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    pipelines: pipelineReducer,
    builds: buildReducer,
    deployments: deploymentReducer,
    alerts: alertReducer,
    dashboard: dashboardReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 