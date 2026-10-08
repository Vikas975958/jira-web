"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import Cookies from "js-cookie";
import { supabase } from "@/lib/supabaseconfig";
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
   * Handle user signup
   * 1. Call authService.signUp with payload
   * 2. Upsert / insert profile into public.profiles
   * 3. Fetch profile from profiles table
   * 4. Dispatch profile details to Redux
   */
  const signUp = async (payload) => {
    setLoading(true);
    setError(null);

    try {
      const {
        email,
        password,
        fullName,
        organizationName,
        employeeCode = null,
        department = null,
        jobTitle = null,
        role = null,
        createdBy = null,
      } = payload;

      const userRole = role || OWNER_ROLE;

      // 1. Call authService signUp
      const data = await authService.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            name: fullName,
            organization_name: organizationName,
            employee_code: employeeCode,
            department: department,
            job_title: jobTitle,
            role: userRole,
            created_by: createdBy || undefined,
          },
        },
      });

      const user = data?.user;
      const session = data?.session;

      if (!user) {
        throw new Error("No user returned from signup service.");
      }

      const finalRole =
        role ||
        user.user_metadata?.role ||
        user.app_metadata?.role ||
        OWNER_ROLE;

      const finalOrg =
        organizationName ||
        user.user_metadata?.organization_name ||
        user.app_metadata?.organization_name ||
        "";

      const finalCreatedBy =
        createdBy ||
        user.user_metadata?.created_by ||
        user.app_metadata?.created_by ||
        user.id;

      // 2. Insert or update user's profile record in profiles table
      const profileData = {
        id: user.id,
        full_name: fullName || "",
        email: email,
        organization_name: finalOrg,
        employee_code: employeeCode || null,
        department: department || null,
        job_title: jobTitle || null,
        role: finalRole,
        status: "active",
        created_by: finalCreatedBy,
      };

      const { error: profileUpsertError } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: "id" });

      if (profileUpsertError) {
        console.warn("Profile upsert notice:", profileUpsertError.message);
      }

      // 3. Fetch profile details from profiles table
      let profile = null;
      const { data: fetchedProfile, error: fetchProfileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!fetchProfileError && fetchedProfile) {
        profile = fetchedProfile;
      }

      // 4. If session is available (auto-login), set token cookie & dispatch to Redux
      if (session?.access_token) {
        Cookies.set("token", session.access_token, { expires: 7, path: "/" });

        const userData = {
          id: user.id,
          email: user.email,
          name: profile?.full_name || fullName || user.email?.split("@")[0] || "User",
          full_name: profile?.full_name || fullName || "",
          organization_name: profile?.organization_name || organizationName || "",
          employee_code: profile?.employee_code || employeeCode || null,
          department: profile?.department || department || null,
          job_title: profile?.job_title || jobTitle || null,
          role: profile?.role || userRole,
          profile_image_url: profile?.profile_image_url || null,
          ...(profile || {}),
        };

        dispatch(
          logingAuth({
            token: session.access_token,
            userId: user.id,
            userData: userData,
            role: userData.role,
          })
        );

        toast.success("Account created successfully! Welcome to Jira.");
        router.push("/dashboard");
        return { success: true, session, user, profile: userData };
      } else {
        toast.success("Account created successfully! Please check your email for confirmation.");
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
   * Handle user signin
   * 1. Call authService.signIn with payload
   * 2. Fetch user profile from profiles table
   * 3. Dispatch profile details to Redux
   */
  const signIn = async (payload) => {
    setLoading(true);
    setError(null);

    try {
      const { email, password } = payload;

      // 1. Call authService signIn
      const data = await authService.signIn({ email, password });
      const user = data?.user;
      const session = data?.session;

      if (!session || !user) {
        throw new Error("Unable to obtain session. Please verify your credentials or email.");
      }

      // Save token to cookie
      if (session.access_token) {
        Cookies.set("token", session.access_token, { expires: 7, path: "/" });
      }

      // 2. Fetch profile from profiles table
      let profile = null;
      const { data: fetchedProfile, error: fetchProfileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!fetchProfileError && fetchedProfile) {
        profile = fetchedProfile;
      }

      // 3. Prepare user details and dispatch to Redux
      const userRole =
        profile?.role ||
        user.user_metadata?.role ||
        "member";

      const userData = {
        id: user.id,
        email: user.email,
        name:
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Jira User",
        full_name: profile?.full_name || user.user_metadata?.full_name || "",
        organization_name: profile?.organization_name || user.user_metadata?.organization_name || "",
        employee_code: profile?.employee_code || user.user_metadata?.employee_code || null,
        department: profile?.department || user.user_metadata?.department || null,
        job_title: profile?.job_title || user.user_metadata?.job_title || null,
        role: userRole,
        profile_image_url: profile?.profile_image_url || null,
        ...(profile || {}),
      };

      dispatch(
        logingAuth({
          token: session.access_token,
          userId: user.id,
          userData: userData,
          role: userRole,
        })
      );

      toast.success("Signed in successfully! Welcome to Jira.");
      router.push("/dashboard");
      return { success: true, session, user, profile: userData };
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
   * Handle user signout
   */
  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      Cookies.remove("token", { path: "/" });
      dispatch(emptyStore());
      toast.info("You have been signed out.");
      router.push("/signin");
    } catch (err) {
      console.error("useAuth signOut error:", err);
      Cookies.remove("token", { path: "/" });
      dispatch(emptyStore());
      router.push("/signin");
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
