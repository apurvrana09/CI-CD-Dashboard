import { createSlice } from '@reduxjs/toolkit';

const pipelineSlice = createSlice({
  name: 'pipelines',
  initialState: {
    pipelines: [],
    loading: false,
    error: null,
  },
  reducers: {
    // Placeholder reducers
  },
});

export default pipelineSlice.reducer; 