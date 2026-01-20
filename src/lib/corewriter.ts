import { ethers } from 'ethers';
import { CORE_WRITER } from './constants';

/**
 * Convert Uint8Array to hex string
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build CoreWriter action header
 */
export function buildHeader(actionId: number): string {
  const header = new Uint8Array(4);
  header[0] = 0x01; // version
  header[1] = (actionId >> 16) & 0xff;
  header[2] = (actionId >> 8) & 0xff;
  header[3] = actionId & 0xff;
  return '0x' + toHex(header);
}

/**
 * Build complete action data
 */
export function buildAction(actionId: number, types: string[], values: unknown[]): string {
  const abiCoder = new ethers.AbiCoder();
  const headerHex = buildHeader(actionId);
  const data = abiCoder.encode(types, values);
  return headerHex + data.slice(2);
}

/**
 * Send CoreWriter action
 */
export async function sendAction(
  signer: ethers.Signer,
  actionId: number,
  types: string[],
  values: unknown[]
): Promise<ethers.TransactionResponse> {
  const data = buildAction(actionId, types, values);
  const cw = new ethers.Contract(
    CORE_WRITER,
    ['function sendRawAction(bytes) external'],
    signer
  );
  return cw.sendRawAction(data);
}

// Action builders
export const actions = {
  usdClassTransfer: (ntl: bigint, toPerp: boolean) => ({
    id: 7,
    types: ['uint64', 'bool'],
    values: [ntl, toPerp],
  }),
  
  spotSend: (destination: string, token: bigint, wei: bigint) => ({
    id: 6,
    types: ['address', 'uint64', 'uint64'],
    values: [destination, token, wei],
  }),
  
  stakingDeposit: (wei: bigint) => ({
    id: 4,
    types: ['uint64'],
    values: [wei],
  }),
  
  stakingWithdraw: (wei: bigint) => ({
    id: 5,
    types: ['uint64'],
    values: [wei],
  }),
  
  vaultTransfer: (vault: string, isDeposit: boolean, usd: bigint) => ({
    id: 2,
    types: ['address', 'bool', 'uint64'],
    values: [vault, isDeposit, usd],
  }),
};
