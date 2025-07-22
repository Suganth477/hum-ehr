import {configureStore} from '@reduxjs/toolkit';
import userReducer from '../slices/userSlice.js';

const store = configureStore({
    reducer: {
        userInfo: userReducer,
    }
});

export default store;