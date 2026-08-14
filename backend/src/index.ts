import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { prisma } from './db';
import { loadConfig } from './config';
import authRoutes from './routes/auth';
import electionPlayerRoutes from './routes/election-player';
import electionDataRoutes from './routes/election-data';
import cryptoAuditRoutes from './routes/crypto-audit';
import superadminRoutes from './routes/superadmin';
import governanceRoutes from "./routes/governance";
import ballotRoutes from './routes/ballot';
import finalizationRoutes from './routes/finalization';
import eligibilityRoutes from './routes/eligibility';
import tallyRoutes from './routes/tally';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

const config = loadConfig();

const app = express();
export { prisma };

// Middleware
app.set('trust proxy', config.trustProxy);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(config.cookieSecret));

const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  limit: config.rateLimitMaxRequests,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use(limiter);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser callers (no Origin) and same-origin requests.
      if (!origin) return callback(null, true);
      if (config.corsOrigins.length === 0) return callback(null, true);
      if (config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

// Basic request logging (lightweight, JSON)
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info('http_request', { method: req.method, path: req.path, ip: req.ip });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/election-player', electionPlayerRoutes);
app.use('/api/election-data', electionDataRoutes);
app.use('/api/crypto-audit', cryptoAuditRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/elections', ballotRoutes);
app.use('/api/elections', finalizationRoutes);
app.use('/api/elections', eligibilityRoutes);
app.use('/api/elections', tallyRoutes);

// Election API routes (inline for now to avoid circular import)
app.get('/api/election', async (req: Request, res: Response) => {
  try {
    const elections = await prisma.election.findMany({
      include: {
        _count: {
          select: {
            voters: true,
            votes: true,
            candidates: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json({
      success: true,
      elections: elections.map(election => ({
        id: election.id,
        name: election.name,
        description: election.description,
        startDate: election.startDate,
        endDate: election.endDate,
        status: election.status,
        stats: {
          candidates: election._count.candidates,
          registeredVoters: election._count.voters,
          votesCast: election._count.votes,
        },
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/election/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const election = await prisma.election.findUnique({
      where: { id },
      include: {
        candidates: true,
        _count: {
          select: { voters: true, votes: true },
        },
      },
    });
    
    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found' });
    }
    
    res.json({
      success: true,
      election: {
        id: election.id,
        name: election.name,
        description: election.description,
        startDate: election.startDate,
        endDate: election.endDate,
        status: election.status,
        publicKey: election.publicKey,
        candidates: election.candidates,
        stats: {
          registeredVoters: election._count.voters,
          votesCast: election._count.votes,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Readiness check (DB connectivity)
app.get('/api/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'ready' });
  } catch (error: any) {
    return res.status(503).json({ status: 'not_ready', error: error.message });
  }
});

// Error handler (shared)
app.use(errorHandler);

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.port, () => logger.info(`server_listening`, { port: config.port }));

  const shutdown = async () => {
    logger.info('shutdown_start');
    server.close(() => logger.info('http_server_closed'));
    try {
      await prisma.$disconnect();
    } catch (e: any) {
      logger.error('prisma_disconnect_failed', { error: e?.message || String(e) });
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export { app };
