"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import organizationService from "@/services/organization.service";

const OrganizationContext = createContext({
  organizations: [],
  currentOrg: null,
  setCurrentOrg: () => {},
  hasOrganization: false,
  loadingOrgs: true,
  refreshOrganizations: async () => {},
});

export function OrganizationProvider({ children }) {
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const [organizations, setOrganizations] = useState([]);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    if (!user?.id) {
      setOrganizations([]);
      setCurrentOrg(null);
      setLoadingOrgs(false);
      return;
    }

    try {
      setLoadingOrgs(true);
      const orgs = await organizationService.getUserOrganizations(user.id);
      const validOrgs = orgs || [];
      setOrganizations(validOrgs);
      if (validOrgs.length > 0) {
        setCurrentOrg(validOrgs[0]);
      } else {
        setCurrentOrg(null);
      }
    } catch (err) {
      console.error("Failed to load organizations in OrganizationContext:", err);
      setOrganizations([]);
      setCurrentOrg(null);
    } finally {
      setLoadingOrgs(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const hasOrganization = organizations.length > 0;

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        setCurrentOrg,
        hasOrganization,
        loadingOrgs,
        refreshOrganizations: fetchOrganizations,
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
