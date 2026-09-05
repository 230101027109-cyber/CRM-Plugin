import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors';

interface LogEntry {
  method: string;
  url: string;
  statusCode: number;
  responseTime: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
}

export const logger = (
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    const logEntry: LogEntry = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    // In production, use a proper logging service
    console.log(`[HTTP] ${logEntry.method} ${logEntry.url} ${logEntry.statusCode} ${logEntry.responseTime}`);
  });

  next();
};

// Error handling middleware
export const errorHandler = (
  err: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  console.error('Unhandled error:', err);
  
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
};
