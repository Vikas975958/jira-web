"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import Cookies from "js-cookie";
import { supabase } from "@/lib/supabaseconfig";
import authService from "@/services/auth.service";
import organizationService from "@/services/organization.service";
import { logingAuth } from "@/store/slices/authSlices";
import { emptyStore } from "@/store/rootReducer";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

export function useAuth() {
  const router = useRouter();
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.authSlice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Handle user signup
   * 1. Create user in Supabase Auth
   * 2. If token present, accept invitation (mark request accepted, associate with org)
   * 3. Insert/update profile record in profiles table
   * 4. Redirect:
   *    - Owner: /dashboard/create-organization
   *    - Invited member/manager: /dashboard
   */
  const signUp = async (payload) => {
    setLoading(true);
    setError(null);

    try {
      const { email, password, fullName, phone = null, token = null, employeeDetails = {} } = payload;

      // Determine validated role: default to 'owner' if no authorized invitation token
      let assignedRole = OWNER_ROLE;
      if (token && (payload.role === MEMBER_ROLE || payload.role === MANAGER_ROLE)) {
        assignedRole = payload.role;
      }

      // 1. Create user in Supabase Auth
      const data = await authService.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            name: fullName,
            phone: phone,
            role: assignedRole,
          },
        },
      });

      const user = data?.user;
      const session = data?.session;

      if (!user) {
        throw new Error("No user returned from signup service.");
      }

      // 2. If token is present, securely accept the invitation
      let invitationAcceptResult = null;
      if (token) {
        try {
          invitationAcceptResult = await organizationService.acceptInvitation({
            token,
            role: assignedRole,
            userId: user.id,
            userEmail: user.email,
            employeeDetails: {
              ...employeeDetails,
              full_name: fullName,
              phone: phone,
            },
          });
        } catch (acceptErr) {
          console.warn("acceptInvitation error during signup:", acceptErr);
        }
      }

      // 3. Upsert profile in profiles table
      const profileData = {
        id: user.id,
        full_name: fullName || "",
        email: email,
        phone: phone || null,
        role: assignedRole,
        department: employeeDetails?.department || null,
        employee_type: employeeDetails?.employee_type || null,
        job_title: employeeDetails?.job_title || null,
        company_name: employeeDetails?.company_name || null,
        organization_id: invitationAcceptResult?.organization_id || employeeDetails?.organization_id || null,
      };

      const { error: profileInsertError } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: "id" });

      if (profileInsertError) {
        // Fallback to essential columns if new employee columns aren't in remote schema yet
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            full_name: fullName || "",
            email: email,
            phone: phone || null,
            role: assignedRole,
          },
          { onConflict: "id" }
        );
      }

      // 4. Fetch updated profile from profiles table
      let profile = null;
      const { data: fetchedProfile, error: fetchProfileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!fetchProfileError && fetchedProfile) {
        profile = fetchedProfile;
      }

      // 5. If session is available (auto-login), set token & dispatch to Redux
      if (session?.access_token) {
        Cookies.set("token", session.access_token, { expires: 7, path: "/" });

        const userData = {
          id: user.id,
          email: user.email,
          full_name: profile?.full_name || fullName || "",
          name: profile?.full_name || fullName || user.email?.split("@")[0] || "User",
          phone: profile?.phone || phone || null,
          role: profile?.role || assignedRole,
          profile_photo: profile?.profile_photo || null,
          organization_id: profile?.organization_id || null,
        };

        dispatch(
          logingAuth({
            token: session.access_token,
            userId: user.id,
            userData: userData,
          })
        );

        if (assignedRole === OWNER_ROLE) {
          toast.success("Account created! Let's set up your organization.");
          router.push("/dashboard/create-organization");
        } else {
          toast.success(`Welcome to the team as ${assignedRole === MANAGER_ROLE ? "Manager" : "Member"}!`);
          router.push("/dashboard");
        }

        return { success: true, session, user, profile: userData };
      } else {
        toast.success("Account created! Please check your email for confirmation.");
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
   * 1. Authenticate with Supabase Auth
   * 2. Fetch user profile
   * 3. Dispatch to Redux & redirect to dashboard
   */
  const signIn = async (payload) => {
    setLoading(true);
    setError(null);

    try {
      const { email, password } = payload;

      // 1. Authenticate
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

      // 3. Sync any approved invitations matching this user's email
      try {
        await organizationService.syncUserWithPendingRequests(user.email, user.id);
      } catch (e) {
        console.warn("syncUserWithPendingRequests notice:", e);
      }

      // 4. Prepare user details and dispatch to Redux
      const userData = {
        id: user.id,
        email: user.email,
        full_name:
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          "",
        name:
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Jira User",
        phone: profile?.phone || null,
        role: profile?.role || OWNER_ROLE,
        profile_photo: profile?.profile_photo || null,
      };

      dispatch(
        logingAuth({
          token: session.access_token,
          userId: user.id,
          userData: userData,
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
