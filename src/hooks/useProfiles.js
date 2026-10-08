"use client";

import { useState, useEffect, useCallback } from "react";
import profileService from "@/services/profile.service";

/**
 * Custom hook for fetching and managing profiles from Supabase.
 * Supports role filtering ('all', 'manager', 'member') and re-fetching.
 *
 * @param {string} initialRole - Initial role filter (defaults to 'all')
 */
export function useProfiles(initialRole = "all") {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roleFilter, setRoleFilter] = useState(initialRole);

  const fetchProfiles = useCallback(async (role = roleFilter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await profileService.fetchProfiles({
        role: role === "all" ? undefined : role,
      });
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
  }, [roleFilter]);

  useEffect(() => {
    fetchProfiles(roleFilter);
  }, [roleFilter, fetchProfiles]);

  const handleRoleChange = (newRole) => {
    setRoleFilter(newRole);
  };

  const refetch = useCallback(() => {
    return fetchProfiles(roleFilter);
  }, [fetchProfiles, roleFilter]);

  return {
    profiles,
    loading,
    error,
    roleFilter,
    setRoleFilter: handleRoleChange,
    refetch,
    fetchProfiles,
  };
}

export default useProfiles;
