import { supabase } from "@/lib/supabaseconfig";

export const authService = {
  // Supabase Sign Up API
  async signUp({ email, password, options = {} }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });

    if (error) throw error;
    return data;
  },

  // Supabase Sign In API
  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  // Supabase Sign Out API
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  },
};

export default authService;
