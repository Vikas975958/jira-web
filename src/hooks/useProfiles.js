"use client";

import { useState, useEffect, useCallback } from "react";
import profileService from "@/services/profile.service";

/**
 * Custom hook for fetching and managing profiles from Supabase.
 */
export function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await profileService.fetchProfiles();
      setProfiles(data || []);
      return data;
    } catch (err) {
      console.error("useProfiles fetchProfiles error:", err);
      const errorMessage = err?.message || "Failed to load profiles. Please try again.";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const refetch = useCallback(() => {
    return fetchProfiles();
  }, [fetchProfiles]);

  return {
    profiles,
    loading,
    error,
    refetch,
    fetchProfiles,
  };
}

export default useProfiles;
