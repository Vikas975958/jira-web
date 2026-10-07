"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import authService from "@/services/authService";
import { logingAuth } from "@/store/slices/authSlices";
import { emptyStore } from "@/store/rootReducer";
import { OWNER_ROLE } from "@/utils/constants";

export function useAuth() {
  const router = useRouter();
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.authSlice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Handle user signup with payload and update Redux state
   */
  const signUp = async (payload) => {
    setLoading(true);
    setError(null);

    try {
      const data = await authService.signUp(payload);
      const user = data?.user;
      const session = data?.session;

      if (session) {
        const resolvedRole = user?.user_metadata?.role || payload?.role || OWNER_ROLE;
        dispatch(
          logingAuth({
            token: session.access_token,
            userId: user.id,
            userData: {
              id: user.id,
              email: user.email,
              name: payload?.fullName || user?.user_metadata?.full_name || "",
              full_name: payload?.fullName || user?.user_metadata?.full_name || "",
              organization_name: payload?.organizationName || user?.user_metadata?.organization_name || "",
              employee_code: payload?.employeeCode || user?.user_metadata?.employee_code || null,
              department: payload?.department || user?.user_metadata?.department || null,
              job_title: payload?.jobTitle || user?.user_metadata?.job_title || null,
              role: resolvedRole,
            },
            role: resolvedRole,
          })
        );
        toast.success("Account created and signed in! Welcome to Jira.");
        router.push("/dashboard");
        return { success: true, session, user };
      } else {
        toast.success("Account created successfully! Check your email if verification is required.");
        return { success: true, session: null, user, requiresVerification: true };
      }
    } catch (err) {
      console.error("useAuth signUp error:", err);
      const message = err?.message || "Failed to create account. Please try again.";
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle user signin and update Redux state
   */
  const signIn = async ({ email, password }) => {
    setLoading(true);
    setError(null);

    try {
      const data = await authService.signIn({ email, password });
      const user = data?.user;
      const session = data?.session;

      if (!session) {
        throw new Error("Unable to obtain session. Please verify your credentials or email.");
      }

      const role = user?.user_metadata?.role || "Software Engineer";

      dispatch(
        logingAuth({
          token: session.access_token,
          userId: user.id,
          userData: {
            id: user.id,
            email: user.email,
            name:
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split("@")[0] ||
              "Jira User",
            role: role,
          },
          role: role,
        })
      );

      toast.success("Signed in successfully! Welcome to Jira.");
      router.push("/dashboard");
      return data;
    } catch (err) {
      console.error("useAuth signIn error:", err);
      const message =
        err?.message === "Invalid login credentials"
          ? "Invalid email or password. Please try again or create an account."
          : err?.message || "Failed to sign in. Please check your credentials.";
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle user signout and clear Redux store
   */
  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      dispatch(emptyStore());
      toast.info("You have been signed out.");
      router.push("/signin");
    } catch (err) {
      console.error("useAuth signOut error:", err);
      toast.error("Failed to sign out properly.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    signUp,
    signIn,
    signOut,
    loading,
    error,
    authState,
    user: authState?.userData,
  };
}

export default useAuth;
