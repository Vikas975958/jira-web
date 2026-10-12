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
      if (!force && lastFetchedUserIdRef.current === user.id && organizations.length > 0) {
        setLoadingOrgs(false);
        return;
      }

      try {
        isFetchingOrgsRef.current = true;
        setLoadingOrgs(true);

        const orgs = await organizationService.getUserOrganizations(user.id);
        const validOrgs = orgs || [];
        lastFetchedUserIdRef.current = user.id;
        setOrganizations(validOrgs);

        if (validOrgs.length > 0) {
          setCurrentOrg((prev) => {
            if (prev) {
              const prevId = prev.organizations?.id || prev.id;
              const found = validOrgs.find(
                (o) => (o.organizations?.id || o.id) === prevId
              );
              if (found) return found;
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
    [user?.id, organizations.length]
  );

  // Shared members fetcher: automatically fetches members for current active organization
  const fetchMembers = useCallback(
    async (force = false) => {
      const orgId = currentOrg?.organizations?.id || currentOrg?.id;
      if (!orgId || !user?.id) {
        setMembers([]);
        return;
      }

      const userRole = currentOrg?.role || user?.role || MEMBER_ROLE;

      if (isFetchingMembersRef.current) return;
      if (!force && lastFetchedOrgIdRef.current === orgId && members.length > 0) {
        return;
      }

      try {
        isFetchingMembersRef.current = true;
        setLoadingMembers(true);
        const data = await organizationService.getOrganizationMembers(orgId, {
          currentUserId: user.id,
          currentUserRole: userRole,
        });
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
    [currentOrg, user?.id, user?.role, members.length]
  );

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    if (currentOrg) {
      fetchMembers();
    }
  }, [currentOrg, fetchMembers]);

  const hasOrganization = organizations.length > 0;

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
        refreshOrganizations: () => fetchOrganizations(true),
        refreshMembers: () => fetchMembers(true),
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
