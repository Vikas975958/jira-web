import { combineReducers, createAction } from "@reduxjs/toolkit";
import authSlice from "./slices/authSlices";
export const emptyStore = createAction("emptyStore");

const rootReducer = combineReducers({
    authSlice,
});

export default rootReducer;


