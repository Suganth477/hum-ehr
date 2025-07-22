import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    user: ["Sri", "Ravi", "Kumar"],
}

export const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUsers: (state, action) => {
            state.user = [...state.users, action.payload];
        },
        delerUsers: (state) => { 
            state.user = state.user.filter(user => user.id !== action.payload.id);
        }
    }
});

export const { setUsers, delerUsers } = userSlice.actions;

export default userSlice.reducer;