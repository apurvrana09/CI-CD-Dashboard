import { createSlice } from '@reduxjs/toolkit';

const deploymentSlice = createSlice({
  name: 'deployments',
  initialState: {
    deployments: [],
    loading: false,
    error: null,
  },
  reducers: {
    // Placeholder reducers
  },
});

export default deploymentSlice.reducer; 