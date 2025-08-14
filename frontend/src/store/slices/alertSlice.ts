import { createSlice } from '@reduxjs/toolkit';

const alertSlice = createSlice({
  name: 'alerts',
  initialState: {
    alerts: [],
    loading: false,
    error: null,
  },
  reducers: {
    // Placeholder reducers
  },
});

export default alertSlice.reducer; 