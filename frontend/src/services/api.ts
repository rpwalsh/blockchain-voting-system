import axios from 'axios';

// Default to same-origin `/api` so a reverse proxy (nginx) can route to backend in production.
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Election {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: string;
  publicKey: string;
  candidates: Candidate[];
}

export interface Candidate {
  id: string;
  name: string;
  party?: string;
  description?: string;
  order: number;
}

export interface VoteReceipt {
  receiptHash: string;
  ledgerEntryHash: string;
  merkleRoot: string;
  timestamp: string;
}

export const electionService = {
  async getElections() {
    const response = await api.get('/election');
    return response.data;
  },
  
  async getElection(id: string) {
    const response = await api.get(`/election/${id}`);
    return response.data;
  },
  
  async getResults(id: string) {
    const response = await api.get(`/election/${id}/results`);
    return response.data;
  },
};

export const voterService = {
  async register(electionId: string, voterId: string, voterData: any) {
    const response = await api.post('/voter/register', {
      electionId,
      voterId,
      voterData,
    });
    return response.data;
  },
  
  async vote(electionId: string, votingToken: string, candidateId: string) {
    const response = await api.post('/voter/vote', {
      electionId,
      votingToken,
      candidateId,
    });
    return response.data;
  },
  
  async verifyVote(receiptHash: string) {
    const response = await api.get(`/voter/verify/${receiptHash}`);
    return response.data;
  },
  
  async getReceipt(votingToken: string, electionId: string) {
    const response = await api.post('/voter/receipt', {
      votingToken,
      electionId,
    });
    return response.data;
  },
};

export const auditService = {
  async getLedger(electionId?: string, limit = 100, offset = 0) {
    const response = await api.get('/audit/ledger', {
      params: { electionId, limit, offset },
    });
    return response.data;
  },
  
  async verifyEntry(entryId: string) {
    const response = await api.get(`/audit/verify/${entryId}`);
    return response.data;
  },
  
  async getElectionIntegrity(electionId: string) {
    const response = await api.get(`/audit/election/${electionId}/integrity`);
    return response.data;
  },
  
  async getStatistics(electionId: string) {
    const response = await api.get(`/audit/election/${electionId}/statistics`);
    return response.data;
  },
  
  async exportAuditTrail(electionId: string) {
    const response = await api.get(`/audit/export/${electionId}`);
    return response.data;
  },
};

export default api;

export const governanceService = {
  async health() {
    const response = await api.get('/governance/health');
    return response.data;
  },

  async getOrg() {
    const response = await api.get('/governance/org');
    return response.data;
  },

  async updateOrgSettings(patch: any) {
    const response = await api.put('/governance/org/settings', patch);
    return response.data;
  },

  async configureOidcProvider(provider: any) {
    const response = await api.post('/governance/org/auth/oidc', provider);
    return response.data;
  },

  async importMembersCsv(csv: string) {
    const response = await api.post('/governance/members/import', { format: 'csv', csv });
    return response.data;
  },

  async listMembers() {
    const response = await api.get('/governance/members');
    return response.data;
  },

  async createEligibilityRule(name: string, expression: any) {
    const response = await api.post('/governance/eligibility-rules', { name, expression });
    return response.data;
  },

  async listEligibilityRules() {
    const response = await api.get('/governance/eligibility-rules');
    return response.data;
  },

  async createElection(payload: any) {
    const response = await api.post('/governance/elections', payload);
    return response.data;
  },

  async listElections() {
    const response = await api.get('/governance/elections');
    return response.data;
  },

  async listPublicElections(orgSlug: string) {
    const response = await api.get(`/governance/public/${encodeURIComponent(orgSlug)}/elections`);
    return response.data;
  },

  async verifyReceipt(receiptHash: string, electionId: string) {
    const response = await api.post('/governance/verifier/receipt', { receiptHash, electionId });
    return response.data;
  },

  async getProofPack(electionId: string) {
    const response = await api.get(`/governance/elections/${electionId}/proof-pack`);
    return response.data;
  },

  async superadminCreateOrg(payload: { name: string; slug: string; type: string; primaryContact: string; email: string }) {
    const response = await api.post('/governance/orgs', payload);
    return response.data;
  },
};
