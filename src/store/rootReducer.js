import { combineReducers } from "@reduxjs/toolkit";
import authSlice from "./slices/authSlices";
import { emptyStore } from "./actions";

export { emptyStore };

const rootReducer = combineReducers({
  authSlice,
});

export default rootReducer;


