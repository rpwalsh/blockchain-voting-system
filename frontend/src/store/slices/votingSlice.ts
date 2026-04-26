/**
 * VOTING SLICE - END-TO-END VOTING FLOW
 * ======================================
 * Cast vote, generate ZK proof, receive receipt, verify on blockchain
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface VoteReceipt {
  receiptHash: string;
  electionId: string;
  electionName: string;
  timestamp: string;
  merkleRoot: string;
  merkleProof: string[];
  blockchainAnchor?: string;
  verified: boolean;
}

export interface VerificationResult {
  valid: boolean;
  electionName: string;
  candidateName: string;
  timestamp: string;
  blockHash: string;
  merkleRoot: string;
  merkleProof: string[];
  ethereumTx?: string;
}

interface VotingState {
  // Vote flow
  selectedCandidateId: string | null;
  votingToken: string | null;
  zkProof: string | null;
  isGeneratingProof: boolean;
  
  // Submission
  isSubmitting: boolean;
  submitError: string | null;
  
  // Receipt
  receipt: VoteReceipt | null;
  receipts: VoteReceipt[]; // History of user's vote receipts
  
  // Verification
  verificationResult: VerificationResult | null;
  isVerifying: boolean;
  verificationError: string | null;
}

const initialState: VotingState = {
  selectedCandidateId: null,
  votingToken: null,
  zkProof: null,
  isGeneratingProof: false,
  isSubmitting: false,
  submitError: null,
  receipt: null,
  receipts: [],
  verificationResult: null,
  isVerifying: false,
  verificationError: null,
};

export const generateVoterToken = createAsyncThunk(
  'voting/generateToken',
  async ({ electionId, voterId }: { electionId: string; voterId: string }) => {
    const response = await api.post(`/election/${electionId}/register`, { voterId });
    return response.data;
  }
);

export const generateZKProof = createAsyncThunk(
  'voting/generateProof',
  async ({ electionId, votingToken, candidateId }: {
    electionId: string;
    votingToken: string;
    candidateId: string;
  }) => {
    const response = await api.post(`/election/${electionId}/generate-proof`, {
      votingToken,
      candidateId,
    });
    return response.data;
  }
);

export const submitVote = createAsyncThunk(
  'voting/submit',
  async ({ electionId, candidateId, votingToken, zkProof, encryptedVote }: {
    electionId: string;
    candidateId: string;
    votingToken: string;
    zkProof: string;
    encryptedVote: string;
  }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/election/${electionId}/vote`, {
        candidateId,
        votingToken,
        zkProof,
        encryptedVote,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Vote submission failed');
    }
  }
);

export const verifyVoteReceipt = createAsyncThunk(
  'voting/verify',
  async (receiptHash: string, { rejectWithValue }) => {
    try {
      const response = await api.post('/blockchain/verify', { receiptHash });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Verification failed');
    }
  }
);

export const fetchUserReceipts = createAsyncThunk(
  'voting/fetchReceipts',
  async (_, { getState }) => {
    const state = getState() as { auth: { token: string } };
    const response = await api.get('/voting/receipts', {
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });
    return response.data;
  }
);

const votingSlice = createSlice({
  name: 'voting',
  initialState,
  reducers: {
    selectCandidate: (state, action: PayloadAction<string>) => {
      state.selectedCandidateId = action.payload;
    },
    clearSelection: (state) => {
      state.selectedCandidateId = null;
    },
    setVotingToken: (state, action: PayloadAction<string>) => {
      state.votingToken = action.payload;
    },
    clearVotingState: (state) => {
      state.selectedCandidateId = null;
      state.votingToken = null;
      state.zkProof = null;
      state.submitError = null;
      state.receipt = null;
    },
    clearVerification: (state) => {
      state.verificationResult = null;
      state.verificationError = null;
    },
    saveReceiptLocally: (state, action: PayloadAction<VoteReceipt>) => {
      // Store in localStorage for persistence
      const receipts = JSON.parse(localStorage.getItem('voteReceipts') || '[]');
      receipts.push(action.payload);
      localStorage.setItem('voteReceipts', JSON.stringify(receipts));
      state.receipts = receipts;
    },
    loadLocalReceipts: (state) => {
      const receipts = JSON.parse(localStorage.getItem('voteReceipts') || '[]');
      state.receipts = receipts;
    },
  },
  extraReducers: (builder) => {
    // Generate Token
    builder.addCase(generateVoterToken.fulfilled, (state, action) => {
      state.votingToken = action.payload.votingToken;
    });

    // Generate ZK Proof
    builder.addCase(generateZKProof.pending, (state) => {
      state.isGeneratingProof = true;
    });
    builder.addCase(generateZKProof.fulfilled, (state, action) => {
      state.isGeneratingProof = false;
      state.zkProof = action.payload.proof;
    });
    builder.addCase(generateZKProof.rejected, (state) => {
      state.isGeneratingProof = false;
    });

    // Submit Vote
    builder.addCase(submitVote.pending, (state) => {
      state.isSubmitting = true;
      state.submitError = null;
    });
    builder.addCase(submitVote.fulfilled, (state, action) => {
      state.isSubmitting = false;
      state.receipt = action.payload.receipt;
      // Add to local receipts
      state.receipts.push(action.payload.receipt);
    });
    builder.addCase(submitVote.rejected, (state, action) => {
      state.isSubmitting = false;
      state.submitError = action.payload as string;
    });

    // Verify Receipt
    builder.addCase(verifyVoteReceipt.pending, (state) => {
      state.isVerifying = true;
      state.verificationError = null;
    });
    builder.addCase(verifyVoteReceipt.fulfilled, (state, action) => {
      state.isVerifying = false;
      state.verificationResult = action.payload;
    });
    builder.addCase(verifyVoteReceipt.rejected, (state, action) => {
      state.isVerifying = false;
      state.verificationError = action.payload as string;
    });

    // Fetch User Receipts
    builder.addCase(fetchUserReceipts.fulfilled, (state, action) => {
      state.receipts = action.payload.receipts;
    });
  },
});

export const {
  selectCandidate,
  clearSelection,
  setVotingToken,
  clearVotingState,
  clearVerification,
  saveReceiptLocally,
  loadLocalReceipts,
} = votingSlice.actions;

export default votingSlice.reducer;
