/**
 * BLOCKCHAIN SLICE - REAL-TIME BLOCK EXPLORER
 * ============================================
 * Production-grade blockchain state management
 * 
 * Features:
 * - Live block feed (WebSocket updates)
 * - Merkle tree visualization
 * - Transaction browser
 * - Vote verification lookup
 * - Chain integrity monitoring
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

// Types
export interface Block {
  id: string;
  height: number;
  hash: string;
  previousHash: string;
  merkleRoot: string;
  timestamp: string;
  transactionCount: number;
  voteCount: number;
  electionId: string;
  electionName: string;
  validatorSignature: string;
  ethereumAnchorTx?: string;
  ethereumBlock?: number;
  status: 'PENDING' | 'CONFIRMED' | 'ANCHORED';
}

export interface Transaction {
  id: string;
  blockId: string;
  voteReceiptHash: string;
  merkleProof: string[];
  timestamp: string;
  electionId: string;
  verified: boolean;
}

export interface BlockchainStats {
  totalBlocks: number;
  totalVotes: number;
  totalElections: number;
  averageBlockTime: number; // seconds
  lastBlockTime: string;
  chainIntegrity: 'VALID' | 'WARNING' | 'COMPROMISED';
  ethereumAnchorStatus: 'SYNCED' | 'PENDING' | 'FAILED';
}

interface BlockchainState {
  blocks: Block[];
  currentBlock: Block | null;
  transactions: Transaction[];
  stats: BlockchainStats | null;
  loading: boolean;
  error: string | null;
  // Real-time updates
  wsConnected: boolean;
  lastUpdate: string | null;
  // Explorer state
  selectedBlock: Block | null;
  selectedTransaction: Transaction | null;
  searchQuery: string;
}

const initialState: BlockchainState = {
  blocks: [],
  currentBlock: null,
  transactions: [],
  stats: null,
  loading: false,
  error: null,
  wsConnected: false,
  lastUpdate: null,
  selectedBlock: null,
  selectedTransaction: null,
  searchQuery: '',
};

// Async thunks
export const fetchBlocks = createAsyncThunk(
  'blockchain/fetchBlocks',
  async ({ page = 1, limit = 50 }: { page?: number; limit?: number } = {}) => {
    const response = await api.get(`/blockchain/blocks?page=${page}&limit=${limit}`);
    return response.data;
  }
);

export const fetchBlockById = createAsyncThunk(
  'blockchain/fetchBlockById',
  async (blockId: string) => {
    const response = await api.get(`/blockchain/blocks/${blockId}`);
    return response.data;
  }
);

export const fetchBlockchainStats = createAsyncThunk(
  'blockchain/fetchStats',
  async () => {
    const response = await api.get('/blockchain/stats');
    return response.data;
  }
);

export const verifyVoteReceipt = createAsyncThunk(
  'blockchain/verifyReceipt',
  async (receiptHash: string) => {
    const response = await api.post('/blockchain/verify', { receiptHash });
    return response.data;
  }
);

export const fetchTransactionsByBlock = createAsyncThunk(
  'blockchain/fetchTransactions',
  async (blockId: string) => {
    const response = await api.get(`/blockchain/blocks/${blockId}/transactions`);
    return response.data;
  }
);

const blockchainSlice = createSlice({
  name: 'blockchain',
  initialState,
  reducers: {
    // Real-time WebSocket actions
    addBlock: (state, action: PayloadAction<Block>) => {
      state.blocks.unshift(action.payload);
      state.currentBlock = action.payload;
      state.lastUpdate = new Date().toISOString();
      // Keep only last 100 blocks in memory
      if (state.blocks.length > 100) {
        state.blocks = state.blocks.slice(0, 100);
      }
    },
    updateBlockStatus: (state, action: PayloadAction<{ blockId: string; status: Block['status'] }>) => {
      const block = state.blocks.find(b => b.id === action.payload.blockId);
      if (block) {
        block.status = action.payload.status;
      }
    },
    setWsConnected: (state, action: PayloadAction<boolean>) => {
      state.wsConnected = action.payload;
    },
    selectBlock: (state, action: PayloadAction<Block>) => {
      state.selectedBlock = action.payload;
    },
    selectTransaction: (state, action: PayloadAction<Transaction>) => {
      state.selectedTransaction = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    clearSelection: (state) => {
      state.selectedBlock = null;
      state.selectedTransaction = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch blocks
    builder.addCase(fetchBlocks.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchBlocks.fulfilled, (state, action) => {
      state.loading = false;
      state.blocks = action.payload.blocks;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchBlocks.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch blocks';
    });

    // Fetch single block
    builder.addCase(fetchBlockById.fulfilled, (state, action) => {
      state.selectedBlock = action.payload.block;
    });

    // Fetch stats
    builder.addCase(fetchBlockchainStats.fulfilled, (state, action) => {
      state.stats = action.payload.stats;
    });

    // Fetch transactions
    builder.addCase(fetchTransactionsByBlock.fulfilled, (state, action) => {
      state.transactions = action.payload.transactions;
    });
  },
});

export const {
  addBlock,
  updateBlockStatus,
  setWsConnected,
  selectBlock,
  selectTransaction,
  setSearchQuery,
  clearSelection,
} = blockchainSlice.actions;

export default blockchainSlice.reducer;
