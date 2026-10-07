import { supabase } from "@/lib/supabaseconfig";
import Cookies from "js-cookie";

export const authService = {
  // Sign up new user
  async signUp({ email, password, fullName }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          name: fullName,
        },
      },
    });

    if (error) {
      throw error;
    }

    if (data?.session?.access_token) {
      Cookies.set("token", data.session.access_token, { expires: 7, path: "/" });
    }

    return data;
  },

  // Sign in existing user
  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (data?.session?.access_token) {
      Cookies.set("token", data.session.access_token, { expires: 7, path: "/" });
    }

    return data;
  },

  // Sign out user
  async signOut() {
    Cookies.remove("token", { path: "/" });
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Supabase signOut error:", error.message);
    }
    return true;
  },

  // Get current active session
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session;
  },

  // Get current user details
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data?.user;
  },

  // Listen to auth state changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

export default authService;
