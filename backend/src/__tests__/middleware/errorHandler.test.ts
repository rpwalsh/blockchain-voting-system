/**
 * Error Handler Middleware Tests
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, errorHandler } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      originalUrl: '/api/test',
      method: 'POST',
      ip: '127.0.0.1',
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('AppError', () => {
    it('should create error with message and status code', () => {
      const error = new AppError('Test error', 400);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('should be instance of Error', () => {
      const error = new AppError('Test error', 404);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Stack test', 500);

      expect(error.stack).toBeDefined();
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError and return correct status', () => {
      const appError = new AppError('Resource not found', 404);

      errorHandler(
        appError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Resource not found',
      });
    });

    it('should log AppError details', () => {
      const appError = new AppError('Bad request', 400);

      errorHandler(
        appError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logger.error).toHaveBeenCalledWith(
        '400 - Bad request - /api/test - POST - 127.0.0.1'
      );
    });

    it('should handle unknown errors with 500 status', () => {
      const unknownError = new Error('Unknown database error');

      errorHandler(
        unknownError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Internal server error',
      });
    });

    it('should log unknown error message and stack', () => {
      const unknownError = new Error('Unexpected error');

      errorHandler(
        unknownError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logger.error).toHaveBeenCalledWith(
        '500 - Unexpected error - /api/test - POST - 127.0.0.1'
      );
      expect(logger.error).toHaveBeenCalledTimes(2); // Message and stack
    });

    it('should handle different HTTP methods', () => {
      const error = new AppError('Method not allowed', 405);
      mockRequest.method = 'DELETE';

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('DELETE')
      );
    });

    it('should handle different URLs', () => {
      const error = new AppError('Not found', 404);
      mockRequest.originalUrl = '/api/elections/123';

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('/api/elections/123')
      );
    });
  });
});
