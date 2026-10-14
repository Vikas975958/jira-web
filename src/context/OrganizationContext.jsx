"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useSelector } from "react-redux";
import organizationService from "@/services/organization.service";
import { MEMBER_ROLE } from "@/utils/constants";

const OrganizationContext = createContext({
  organizations: [],
  currentOrg: null,
  setCurrentOrg: () => {},
  hasOrganization: false,
  loadingOrgs: true,
  members: [],
  loadingMembers: false,
  refreshOrganizations: async () => {},
  refreshMembers: async () => {},
});

export function OrganizationProvider({ children }) {
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const [organizations, setOrganizations] = useState([]);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // In-flight and last fetched trackers to prevent duplicate/repeated calls
  const isFetchingOrgsRef = useRef(false);
  const lastFetchedUserIdRef = useRef(null);
  const isFetchingMembersRef = useRef(false);
  const lastFetchedOrgIdRef = useRef(null);

  const organizationsRef = useRef(organizations);
  const currentOrgRef = useRef(currentOrg);
  const membersRef = useRef(members);

  useEffect(() => {
    organizationsRef.current = organizations;
  }, [organizations]);

  useEffect(() => {
    currentOrgRef.current = currentOrg;
  }, [currentOrg]);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const fetchOrganizations = useCallback(
    async (force = false) => {
      if (!user?.id) {
        setOrganizations([]);
        setCurrentOrg(null);
        setMembers([]);
        setLoadingOrgs(false);
        lastFetchedUserIdRef.current = null;
        lastFetchedOrgIdRef.current = null;
        return;
      }

      // If already fetching or already fetched for this user without force, avoid duplicate hit
      if (isFetchingOrgsRef.current) return;
      if (!force && lastFetchedUserIdRef.current === user.id) {
        setLoadingOrgs(false);
        return;
      }

      try {
        isFetchingOrgsRef.current = true;
        setLoadingOrgs(true);

        const orgs = await organizationService.getUserOrganizations(user.id, force);
        // Single workspace policy: strictly keep only the single organization
        const validOrgs = orgs && orgs.length > 0 ? [orgs[0]] : [];
        lastFetchedUserIdRef.current = user.id;
        setOrganizations(validOrgs);

        if (validOrgs.length > 0) {
          setCurrentOrg((prev) => {
            const prevId = prev?.organizations?.id || prev?.id;
            const newId = validOrgs[0]?.organizations?.id || validOrgs[0]?.id;
            if (prev && prevId === newId && prev.role === validOrgs[0].role) {
              return prev;
            }
            return validOrgs[0];
          });
        } else {
          setCurrentOrg(null);
          setMembers([]);
        }
      } catch (err) {
        console.error("Failed to load organizations in OrganizationContext:", err);
        setOrganizations([]);
        setCurrentOrg(null);
        setMembers([]);
      } finally {
        setLoadingOrgs(false);
        isFetchingOrgsRef.current = false;
      }
    },
    [user?.id]
  );

  // Shared members fetcher: automatically fetches members for current active organization
  const fetchMembers = useCallback(
    async (force = false) => {
      const activeOrg = currentOrgRef.current;
      const orgId = activeOrg?.organizations?.id || activeOrg?.id;
      if (!orgId || !user?.id) {
        setMembers([]);
        return;
      }

      const userRole = activeOrg?.role || user?.role || MEMBER_ROLE;

      if (isFetchingMembersRef.current) return;
      if (!force && lastFetchedOrgIdRef.current === orgId) {
        return;
      }

      try {
        isFetchingMembersRef.current = true;
        setLoadingMembers(true);
        const data = await organizationService.getOrganizationMembers(
          orgId,
          {
            currentUserId: user.id,
            currentUserRole: userRole,
          },
          force
        );
        lastFetchedOrgIdRef.current = orgId;
        setMembers(data || []);
      } catch (err) {
        console.error("Failed to load members in OrganizationContext:", err);
        setMembers([]);
      } finally {
        setLoadingMembers(false);
        isFetchingMembersRef.current = false;
      }
    },
    [user?.id, user?.role]
  );

  const currentOrgId = currentOrg?.organizations?.id || currentOrg?.id;

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    if (currentOrgId) {
      fetchMembers();
    }
  }, [currentOrgId, fetchMembers]);

  const hasOrganization = organizations.length > 0;

  const refreshOrganizations = useCallback(() => fetchOrganizations(true), [fetchOrganizations]);
  const refreshMembers = useCallback(() => fetchMembers(true), [fetchMembers]);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        setCurrentOrg,
        hasOrganization,
        loadingOrgs,
        members,
        loadingMembers,
        refreshOrganizations,
        refreshMembers,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  return context;
}
