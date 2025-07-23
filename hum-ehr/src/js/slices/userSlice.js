import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import env from '../../env.js';

const initialState = {
    user: ["Sri", "Ravi", "Kumar"],
    patientDetails: null,
    loading: false,
    error: null
};

export const fetchPatientDetails = createAsyncThunk(
  'user/fetchPatientDetails',
  async (patientId, thunkAPI) => {
    const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0aW5nX3N1cHJpeWFhIiwidGltZW91dFNjcmVlbiI6IiIsInRpbWV6b25lIjoiVVMvRWFzdGVybiIsImlzV2ViTG9naW4iOiJZIiwidGltZW91dER1cmF0aW9uIjo2MC4wLCJ1c2VySWQiOjMzNjg5LCJsb2dnZWRJbkNsaW5pY2lhbklkIjotMSwibG9nZ2VkSW5QaHlzaWNpYW5JZCI6LTEsImF1ZCI6IndlYiIsImNsaW5pY2lhbkFkbWluRmxhZyI6IlkiLCJhdWRpdExvZ1VVSUQiOiIxZDJhM2Q3Ni05YmRiLTRiYTEtOWNiYS03M2Q5ZmI3NGVjMTgtMjAyNC0wNC0wOC0xOS00MS0yMSIsInBoeXNpY2lhbkFkbWluRmxhZyI6Ik4iLCJyb2xlQ29kZSI6IkNNU0NMSU5JQ0kiLCJpc1RpbWVvdXQiOiJOIiwiY2xpbmljaWFuU3VwZXJ2aXNvckZsYWciOiJZIiwiZXhwIjoxNzUzMjgzOTYzLCJpYXQiOjE3NTMxOTc1NjM0MTQsImp0aSI6ImJhODQwZDYwLTFjZTQtNDM1Ni1iODRhLWM4NThlZjhlYmYyMCJ9.2LETNKRYN97n-KW66StOaz3iXvafS26ZeO-XvXrt6BA";
    try {
      const formData = new FormData();
      formData.append('patientId', patientId);
      const response = await fetch(`${env.BASE_URL}/patient/details`, {
        method: 'POST',
        headers: {
          'x-auth-token': token
        },
        body: formData
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

export const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUsers: (state, action) => {
            state.user = [...state.user, action.payload];
        },
        delerUsers: (state, action) => { 
            state.user = state.user.filter(user => user.id !== action.payload.id);
        }
    },
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
    }
});

export const { setUsers, delerUsers } = userSlice.actions;

export default userSlice.reducer;