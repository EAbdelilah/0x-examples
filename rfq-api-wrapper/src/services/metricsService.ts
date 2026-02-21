import { Registry, Counter, Gauge, collectDefaultMetrics } from 'prom-client';

export class MetricsService {
  private registry: Registry;
  public strategyExecutions: Counter;
  public strategySuccess: Counter;
  public strategyFail: Counter;
  public totalProfit: Gauge;
  public rpcLatency: Gauge;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

    this.strategyExecutions = new Counter({
      name: 'strategy_executions_total',
      help: 'Total number of strategy execution attempts',
      labelNames: ['strategy', 'chainId'],
      registers: [this.registry],
    });

    this.strategySuccess = new Counter({
      name: 'strategy_success_total',
      help: 'Total number of successful strategy executions',
      labelNames: ['strategy', 'chainId'],
      registers: [this.registry],
    });

    this.strategyFail = new Counter({
      name: 'strategy_fail_total',
      help: 'Total number of failed strategy executions',
      labelNames: ['strategy', 'chainId'],
      registers: [this.registry],
    });

    this.totalProfit = new Gauge({
      name: 'strategy_profit_total',
      help: 'Total tracked profit per strategy',
      labelNames: ['strategy', 'chainId', 'token'],
      registers: [this.registry],
    });

    this.rpcLatency = new Gauge({
      name: 'rpc_latency_ms',
      help: 'Current RPC latency in milliseconds',
      labelNames: ['chainId'],
      registers: [this.registry],
    });
  }

  async getMetrics() {
    return await this.registry.metrics();
  }

  getContentType() {
    return this.registry.contentType;
  }
}

export const metrics = new MetricsService();
