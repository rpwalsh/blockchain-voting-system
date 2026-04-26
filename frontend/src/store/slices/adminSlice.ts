/**
 * ADMIN SLICE - SUPER ADMIN OPERATIONS
 * =====================================
 * Organization, election, and user management for Level 12 access
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: 'FEDERAL' | 'STATE' | 'MUNICIPAL' | 'CORPORATE' | 'PROJECT' | 'BOARD' | 'NGO';
  tier: 'FREE' | 'STARTER' | 'ENTERPRISE' | 'UNLIMITED';
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELLED';
  email: string;
  primaryContact: string;
  phone?: string;
  website?: string;
  maxVoters: number;
  createdAt: string;
  _count: {
    elections: number;
    users: number;
  };
}

export interface AdminElection {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  _count: {
    candidates: number;
    voters: number;
    votes: number;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: string;
  organizationId: string;
  organizationName: string;
  isActive: boolean;
  createdAt: string;
}

export interface SystemStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalElections: number;
  activeElections: number;
  totalVotes: number;
  todayVotes: number;
  securityEvents: number;
  criticalEvents: number;
}

interface AdminState {
  organizations: Organization[];
  elections: AdminElection[];
  users: AdminUser[];
  stats: SystemStats | null;
  loading: boolean;
  error: string | null;
  success: string | null;
}

const initialState: AdminState = {
  organizations: [],
  elections: [],
  users: [],
  stats: null,
  loading: false,
  error: null,
  success: null,
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return { Authorization: `Bearer ${token}` };
};

// Organizations
export const fetchOrganizations = createAsyncThunk(
  'admin/fetchOrganizations',
  async () => {
    const response = await api.get('/superadmin/organizations', { headers: getAuthHeaders() });
    return response.data;
  }
);

export const createOrganization = createAsyncThunk(
  'admin/createOrganization',
  async (orgData: Partial<Organization>, { rejectWithValue }) => {
    try {
      const response = await api.post('/superadmin/organizations', orgData, { headers: getAuthHeaders() });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create organization');
    }
  }
);

export const deleteOrganization = createAsyncThunk(
  'admin/deleteOrganization',
  async (orgId: string, { rejectWithValue }) => {
    try {
      await api.delete(`/superadmin/organizations/${orgId}`, { headers: getAuthHeaders() });
      return orgId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete organization');
    }
  }
);

// Elections
export const fetchAdminElections = createAsyncThunk(
  'admin/fetchElections',
  async () => {
    const response = await api.get('/superadmin/elections', { headers: getAuthHeaders() });
    return response.data;
  }
);

export const createElection = createAsyncThunk(
  'admin/createElection',
  async (electionData: {
    organizationId: string;
    name: string;
    description?: string;
    type: string;
    startDate: string;
    endDate: string;
    candidates: { name: string; party?: string; biography?: string }[];
  }, { rejectWithValue }) => {
    try {
      const response = await api.post('/superadmin/elections', electionData, { headers: getAuthHeaders() });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create election');
    }
  }
);

export const deleteElection = createAsyncThunk(
  'admin/deleteElection',
  async (electionId: string, { rejectWithValue }) => {
    try {
      await api.delete(`/superadmin/elections/${electionId}`, { headers: getAuthHeaders() });
      return electionId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete election');
    }
  }
);

// Users
export const fetchAdminUsers = createAsyncThunk(
  'admin/fetchUsers',
  async () => {
    const response = await api.get('/superadmin/users', { headers: getAuthHeaders() });
    return response.data;
  }
);

// Dashboard Stats
export const fetchDashboardStats = createAsyncThunk(
  'admin/fetchStats',
  async () => {
    const response = await api.get('/superadmin/dashboard', { headers: getAuthHeaders() });
    return response.data;
  }
);

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearMessages: (state) => {
      state.error = null;
      state.success = null;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    setSuccess: (state, action: PayloadAction<string>) => {
      state.success = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch Organizations
    builder.addCase(fetchOrganizations.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchOrganizations.fulfilled, (state, action) => {
      state.loading = false;
      state.organizations = action.payload.organizations || [];
    });
    builder.addCase(fetchOrganizations.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch organizations';
    });

    // Create Organization
    builder.addCase(createOrganization.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(createOrganization.fulfilled, (state, action) => {
      state.loading = false;
      state.organizations.unshift(action.payload.organization);
      state.success = 'Organization created successfully!';
    });
    builder.addCase(createOrganization.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Delete Organization
    builder.addCase(deleteOrganization.fulfilled, (state, action) => {
      state.organizations = state.organizations.filter(o => o.id !== action.payload);
      state.success = 'Organization deleted successfully!';
    });
    builder.addCase(deleteOrganization.rejected, (state, action) => {
      state.error = action.payload as string;
    });

    // Fetch Elections
    builder.addCase(fetchAdminElections.fulfilled, (state, action) => {
      state.elections = action.payload.elections || [];
    });

    // Create Election
    builder.addCase(createElection.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(createElection.fulfilled, (state, action) => {
      state.loading = false;
      state.elections.unshift(action.payload.election);
      state.success = 'Election created successfully!';
    });
    builder.addCase(createElection.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Delete Election
    builder.addCase(deleteElection.fulfilled, (state, action) => {
      state.elections = state.elections.filter(e => e.id !== action.payload);
      state.success = 'Election deleted successfully!';
    });

    // Fetch Users
    builder.addCase(fetchAdminUsers.fulfilled, (state, action) => {
      state.users = action.payload.users || [];
    });

    // Fetch Stats
    builder.addCase(fetchDashboardStats.fulfilled, (state, action) => {
      state.stats = action.payload.dashboard?.statistics;
    });
  },
});

export const { clearMessages, setError, setSuccess } = adminSlice.actions;
export default adminSlice.reducer;
