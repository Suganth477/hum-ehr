import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import env from '../../env.js';
import Cookies from 'js-cookie';

const initialState = {
  patientDetails: null,
  loading: false,
  error: null,
};

export const fetchPatientDetails = createAsyncThunk(
  'user/fetchPatientDetails',
  async (patientId, thunkAPI) => {
    const token = Cookies.get('X-Auth-Token');
    try {
      const formData = new FormData();
      formData.append('patientId', patientId);
      const response = await fetch(`${env.BASE_URL}/patient/details`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
        },
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return await response.json();
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPatientDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPatientDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.patientDetails = action.payload;
      })
      .addCase(fetchPatientDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});


export default userSlice.reducer;