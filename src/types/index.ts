export interface TxLog {
  id: string;
  type: 'Precompile' | 'CoreWriter';
  action: string;
  hash?: string;
  status: 'pending' | 'success' | 'error';
  timestamp: Date;
  details?: string;
  before?: string;
  after?: string;
}

export interface Balances {
  perp: number;
  spot: Record<string, number>;
}

export interface CoreWriterAction {
  id: number;
  name: string;
  status: 'tested' | 'skip';
  params: string[];
  types?: string[];
  description?: string;
}

export interface PrecompileInfo {
  name: string;
  address: string;
  description: string;
}
