import { createSlice } from '@reduxjs/toolkit';

const buildSlice = createSlice({
  name: 'builds',
  initialState: {
    builds: [],
    loading: false,
    error: null,
  },
  reducers: {
    // Placeholder reducers
  },
});

export default buildSlice.reducer; 