import { createSlice } from "@reduxjs/toolkit";
import { emptyStore } from "../rootReducer";

const initialisation = {
  token: null,
  userId: null,
  userData: null,
  role: null,
  resetToken: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState: initialisation,
  reducers: {
    logingAuth: (state, action) => {
      state.userData = action?.payload?.userData;
      state.token = action?.payload.token;
      state.userId = action?.payload?.userId;
      state.role = action?.payload?.role;
      state.resetToken = action?.payload?.resetToken;
    },
    updateProfile: (state, action) => {
      state.userData = {
        ...state.userData,
        ...action?.payload,
      };
    },
    updateProfileImage: (state, action) => {
      if (state.userData) {
        state.userData.profileImageUrl = action?.payload;
      }
    },
    resetPassword: (state, action) => {
      state.resetToken = action?.payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(emptyStore, () => {
      return initialisation;
    });
  },
});

export const { logingAuth, updateProfile, updateProfileImage, resetPassword } = authSlice.actions;
export default authSlice.reducer;
