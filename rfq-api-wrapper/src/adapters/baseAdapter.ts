import { ZeroExService } from '../services/zeroExService';

export interface AggregatorAdapter {
  name: string;
  handleQuote(req: any): Promise<any>;
}

export abstract class BaseAdapter implements AggregatorAdapter {
  constructor(
    public name: string,
    protected zeroExService: ZeroExService
  ) {}

  abstract handleQuote(req: any): Promise<any>;
}
