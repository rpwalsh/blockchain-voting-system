/**
 * ELECTIONS SLICE - REAL-TIME ELECTION MANAGEMENT
 * ================================================
 * Production-grade state for millions of concurrent voters
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface Candidate {
  id: string;
  name: string;
  party?: string;
  description?: string;
  photoUrl?: string;
  voteCount: number;
  percentage: number;
}

export interface Election {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  description?: string;
  type: string;
  status: 'DRAFT' | 'REGISTRATION' | 'VOTING' | 'TALLYING' | 'COMPLETED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  candidates: Candidate[];
  registeredVoters: number;
  votesCast: number;
  turnoutPercentage: number;
  merkleRoot?: string;
  blockchainTx?: string;
  publicKey: string;
}

export interface ElectionStats {
  totalElections: number;
  activeElections: number;
  completedElections: number;
  totalVotesCast: number;
  averageTurnout: number;
}

interface ElectionsState {
  elections: Election[];
  selectedElection: Election | null;
  stats: ElectionStats | null;
  loading: boolean;
  error: string | null;
  // Real-time
  liveUpdates: boolean;
  lastVoteTime: string | null;
}

const initialState: ElectionsState = {
  elections: [],
  selectedElection: null,
  stats: null,
  loading: false,
  error: null,
  liveUpdates: false,
  lastVoteTime: null,
};

// Async thunks
export const fetchElections = createAsyncThunk(
  'elections/fetchAll',
  async () => {
    const response = await api.get('/election');
    return response.data;
  }
);

export const fetchElectionById = createAsyncThunk(
  'elections/fetchById',
  async (electionId: string) => {
    const response = await api.get(`/election/${electionId}`);
    return response.data;
  }
);

export const fetchElectionStats = createAsyncThunk(
  'elections/fetchStats',
  async () => {
    const response = await api.get('/election/stats');
    return response.data;
  }
);

export const castVote = createAsyncThunk(
  'elections/castVote',
  async ({ electionId, candidateId, votingToken, zkProof }: {
    electionId: string;
    candidateId: string;
    votingToken: string;
    zkProof: string;
  }) => {
    const response = await api.post(`/election/${electionId}/vote`, {
      candidateId,
      votingToken,
      zkProof,
    });
    return response.data;
  }
);

const electionsSlice = createSlice({
  name: 'elections',
  initialState,
  reducers: {
    // Real-time vote update from WebSocket
    incrementVoteCount: (state, action: PayloadAction<{ electionId: string; candidateId: string }>) => {
      const election = state.elections.find(e => e.id === action.payload.electionId);
      if (election) {
        const candidate = election.candidates.find(c => c.id === action.payload.candidateId);
        if (candidate) {
          candidate.voteCount += 1;
          election.votesCast += 1;
          election.turnoutPercentage = (election.votesCast / election.registeredVoters) * 100;
          // Recalculate percentages
          election.candidates.forEach(c => {
            c.percentage = (c.voteCount / election.votesCast) * 100;
          });
        }
      }
      state.lastVoteTime = new Date().toISOString();
    },
    updateElectionStatus: (state, action: PayloadAction<{ electionId: string; status: Election['status'] }>) => {
      const election = state.elections.find(e => e.id === action.payload.electionId);
      if (election) {
        election.status = action.payload.status;
      }
    },
    selectElection: (state, action: PayloadAction<Election>) => {
      state.selectedElection = action.payload;
    },
    clearSelectedElection: (state) => {
      state.selectedElection = null;
    },
    setLiveUpdates: (state, action: PayloadAction<boolean>) => {
      state.liveUpdates = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchElections.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchElections.fulfilled, (state, action) => {
      state.loading = false;
      state.elections = action.payload.elections || [];
    });
    builder.addCase(fetchElections.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch elections';
    });
    builder.addCase(fetchElectionById.fulfilled, (state, action) => {
      state.selectedElection = action.payload.election;
    });
    builder.addCase(fetchElectionStats.fulfilled, (state, action) => {
      state.stats = action.payload.stats;
    });
  },
});

export const {
  incrementVoteCount,
  updateElectionStatus,
  selectElection,
  clearSelectedElection,
  setLiveUpdates,
} = electionsSlice.actions;

export default electionsSlice.reducer;
