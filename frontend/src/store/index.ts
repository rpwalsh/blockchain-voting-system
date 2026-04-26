/**
 * REDUX STORE - PRODUCTION GRADE
 * ===============================
 * Handles global state for millions of concurrent users
 * LA Mayoral Election: 4M+ registered voters
 * Peak load: 500K requests/minute during polls closing
 */

import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import electionsReducer from './slices/electionsSlice';
import blockchainReducer from './slices/blockchainSlice';
import authReducer from './slices/authSlice';
import votingReducer from './slices/votingSlice';
import adminReducer from './slices/adminSlice';

export const store = configureStore({
  reducer: {
    elections: electionsReducer,
    blockchain: blockchainReducer,
    auth: authReducer,
    voting: votingReducer,
    admin: adminReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['voting/uploadProof', 'blockchain/addBlock'],
        ignoredPaths: ['voting.proofFile', 'blockchain.currentBlock.timestamp'],
      },
    }),
  devTools: import.meta.env.MODE !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks for use throughout app
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
