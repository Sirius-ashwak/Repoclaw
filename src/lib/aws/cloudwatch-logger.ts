/**
 * CloudWatch Logger
 * Structured logging for AWS CloudWatch integration
 * Logs all AWS service calls, errors, and performance metrics
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  action: string;
  message: string;
  pipelineId?: string;
  sessionId?: string;
  duration?: number;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface PerformanceMetric {
  service: string;
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

/**
 * CloudWatch-compatible structured logger
 * In production, these logs are automatically picked up by CloudWatch Logs
 * via the Lambda/ECS execution environment
 */
export class CloudWatchLogger {
  private serviceName: string;
  private pipelineId?: string;
  private sessionId?: string;
  private metrics: PerformanceMetric[] = [];

  constructor(serviceName: string, context?: { pipelineId?: string; sessionId?: string }) {
    this.serviceName = serviceName;
    this.pipelineId = context?.pipelineId;
    this.sessionId = context?.sessionId;
  }

  /**
   * Set pipeline context for all subsequent log entries
   */
  setContext(context: { pipelineId?: string; sessionId?: string }): void {
    if (context.pipelineId) this.pipelineId = context.pipelineId;
    if (context.sessionId) this.sessionId = context.sessionId;
  }

  debug(action: string, message: string, metadata?: Record<string, any>): void {
    this._log('DEBUG', action, message, metadata);
  }

  info(action: string, message: string, metadata?: Record<string, any>): void {
    this._log('INFO', action, message, metadata);
  }

  warn(action: string, message: string, metadata?: Record<string, any>): void {
    this._log('WARN', action, message, metadata);
  }

  error(action: string, message: string, error?: Error, metadata?: Record<string, any>): void {
    this._log('ERROR', action, message, metadata, error);
  }

  fatal(action: string, message: string, error?: Error, metadata?: Record<string, any>): void {
    this._log('FATAL', action, message, metadata, error);
  }

  /**
   * Track a performance metric
   */
  trackMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Log metrics that exceed thresholds
    if (metric.duration > 5000) {
      this.warn(
        'slow_operation',
        `Slow operation: ${metric.service}.${metric.operation} took ${metric.duration}ms`,
        { ...metric.metadata, duration: metric.duration }
      );
    }

    // Structured metric log for CloudWatch Metrics filter
    console.log(JSON.stringify({
      _type: 'METRIC',
      service: metric.service,
      operation: metric.operation,
      duration: metric.duration,
      success: metric.success,
      timestamp: new Date().toISOString(),
      pipelineId: this.pipelineId,
      ...metric.metadata,
    }));
  }

  /**
   * Time an async operation and log the result
   */
  async timeAsync<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.trackMetric({
        service,
        operation,
        duration,
        success: true,
        metadata,
      });

      this.debug(operation, `${service}.${operation} completed in ${duration}ms`, {
        ...metadata,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.trackMetric({
        service,
        operation,
        duration,
        success: false,
        metadata: { ...metadata, error: (error as Error).message },
      });

      this.error(
        operation,
        `${service}.${operation} failed after ${duration}ms`,
        error as Error,
        { ...metadata, duration }
      );

      throw error;
    }
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    totalOperations: number;
    successCount: number;
    failureCount: number;
    avgDuration: number;
    maxDuration: number;
    byService: Record<string, { count: number; avgDuration: number }>;
  } {
    const summary = {
      totalOperations: this.metrics.length,
      successCount: this.metrics.filter((m) => m.success).length,
      failureCount: this.metrics.filter((m) => !m.success).length,
      avgDuration: 0,
      maxDuration: 0,
      byService: {} as Record<string, { count: number; avgDuration: number }>,
    };

    if (this.metrics.length > 0) {
      const durations = this.metrics.map((m) => m.duration);
      summary.avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      summary.maxDuration = Math.max(...durations);

      // Group by service
      for (const metric of this.metrics) {
        if (!summary.byService[metric.service]) {
          summary.byService[metric.service] = { count: 0, avgDuration: 0 };
        }
        summary.byService[metric.service].count++;
      }

      // Calculate avg duration per service
      for (const service of Object.keys(summary.byService)) {
        const serviceMetrics = this.metrics.filter((m) => m.service === service);
        summary.byService[service].avgDuration =
          serviceMetrics.reduce((a, m) => a + m.duration, 0) / serviceMetrics.length;
      }
    }

    return summary;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = [];
  }

  /**
   * Internal log method - outputs CloudWatch-compatible structured JSON
   */
  private _log(
    level: LogLevel,
    action: string,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      action,
      message,
      pipelineId: this.pipelineId,
      sessionId: this.sessionId,
      metadata,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Output as structured JSON for CloudWatch Logs
    const logFn = level === 'ERROR' || level === 'FATAL' ? console.error : console.log;
    logFn(JSON.stringify(entry));
  }
}

/**
 * Circuit Breaker for AWS service calls
 * Prevents cascading failures by short-circuiting after threshold failures
 */
export class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private logger: CloudWatchLogger;

  constructor(
    private serviceName: string,
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 30000
  ) {
    this.logger = new CloudWatchLogger('CircuitBreaker');
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open';
        this.logger.info('state_change', `Circuit breaker for ${this.serviceName} entering half-open state`);
      } else {
        throw new Error(`Circuit breaker OPEN for ${this.serviceName}: too many failures`);
      }
    }

    try {
      const result = await fn();

      // Success - reset on half-open
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failureCount = 0;
        this.logger.info('state_change', `Circuit breaker for ${this.serviceName} closed (recovered)`);
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'open';
        this.logger.error(
          'circuit_open',
          `Circuit breaker OPEN for ${this.serviceName} after ${this.failureCount} failures`,
          error as Error
        );
      }

      throw error;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): { state: string; failureCount: number; lastFailureTime: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
