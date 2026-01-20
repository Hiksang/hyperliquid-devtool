/**
 * CoreWriter Calldata Decoder
 *
 * CoreWriter에 전송된 calldata를 디코딩하여 어떤 action과 파라미터가 사용되었는지 보여줍니다.
 * 대시보드나 트랜잭션 분석에 활용할 수 있습니다.
 *
 * Usage:
 *   const decoder = new CoreWriterDecoder();
 *   const result = decoder.decode('0x01000007...');
 *   console.log(result);
 *
 * Requirements:
 *   npm install ethers
 */

const { ethers } = require('ethers');

// ============================================
// Action Definitions
// ============================================

const ACTION_DEFINITIONS = {
  1: {
    name: 'Limit Order',
    description: '지정가 주문',
    params: ['uint32', 'bool', 'uint64', 'uint64', 'bool', 'uint8', 'uint128'],
    paramNames: ['asset', 'isBuy', 'limitPx', 'sz', 'reduceOnly', 'encodedTif', 'cloid'],
    formatters: {
      asset: (v) => `${v} (${getAssetName(v)})`,
      isBuy: (v) => v ? '매수 (Buy)' : '매도 (Sell)',
      limitPx: (v) => `${Number(v) / 1e8} USD (raw: ${v})`,
      sz: (v) => `${v} (raw)`,
      reduceOnly: (v) => v ? 'Yes' : 'No',
      encodedTif: (v) => getTifName(v),
      cloid: (v) => v === 0n ? '없음' : v.toString(),
    },
  },
  2: {
    name: 'Vault Transfer',
    description: 'Vault 입출금',
    params: ['address', 'bool', 'uint64'],
    paramNames: ['vault', 'isDeposit', 'usd'],
    formatters: {
      vault: (v) => v,
      isDeposit: (v) => v ? '입금 (Deposit)' : '출금 (Withdraw)',
      usd: (v) => `${Number(v) / 1e6} USD (raw: ${v})`,
    },
  },
  3: {
    name: 'Token Delegate',
    description: '토큰 위임/해제',
    params: ['address', 'uint64', 'bool'],
    paramNames: ['validator', 'wei', 'isUndelegate'],
    formatters: {
      validator: (v) => v,
      wei: (v) => `${Number(v) / 1e18} tokens (raw: ${v})`,
      isUndelegate: (v) => v ? '위임 해제 (Undelegate)' : '위임 (Delegate)',
    },
  },
  4: {
    name: 'Staking Deposit',
    description: '스테이킹 입금',
    params: ['uint64'],
    paramNames: ['wei'],
    formatters: {
      wei: (v) => `${Number(v) / 1e18} tokens (raw: ${v})`,
    },
  },
  5: {
    name: 'Staking Withdraw',
    description: '스테이킹 출금',
    params: ['uint64'],
    paramNames: ['wei'],
    formatters: {
      wei: (v) => `${Number(v) / 1e18} tokens (raw: ${v})`,
    },
  },
  6: {
    name: 'Spot Send',
    description: '⚠️ 스팟 토큰 전송 (자금 손실 주의)',
    params: ['address', 'uint64', 'uint64'],
    paramNames: ['destination', 'token', 'wei'],
    formatters: {
      destination: (v) => v,
      token: (v) => `Token #${v}`,
      wei: (v) => `${v} (raw)`,
    },
  },
  7: {
    name: 'USD Class Transfer',
    description: 'Spot↔Perp USD 이동',
    params: ['uint64', 'bool'],
    paramNames: ['ntl', 'toPerp'],
    formatters: {
      ntl: (v) => `${Number(v) / 1e6} USD (raw: ${v})`,
      toPerp: (v) => v ? 'Spot → Perp' : 'Perp → Spot',
    },
  },
  8: {
    name: 'Finalize EVM Contract',
    description: 'EVM 컨트랙트 완료',
    params: ['uint64', 'uint8', 'uint64'],
    paramNames: ['token', 'variant', 'createNonce'],
    formatters: {
      token: (v) => `Token #${v}`,
      variant: (v) => getVariantName(v),
      createNonce: (v) => v.toString(),
    },
  },
  9: {
    name: 'Add API Wallet',
    description: 'API 지갑 추가',
    params: ['address', 'string'],
    paramNames: ['wallet', 'name'],
    formatters: {
      wallet: (v) => v,
      name: (v) => `"${v}"`,
    },
  },
  10: {
    name: 'Cancel Order by OID',
    description: '주문 ID로 취소',
    params: ['uint32', 'uint64'],
    paramNames: ['asset', 'oid'],
    formatters: {
      asset: (v) => `${v} (${getAssetName(v)})`,
      oid: (v) => v.toString(),
    },
  },
  11: {
    name: 'Cancel Order by CLOID',
    description: '클라이언트 주문 ID로 취소',
    params: ['uint32', 'uint128'],
    paramNames: ['asset', 'cloid'],
    formatters: {
      asset: (v) => `${v} (${getAssetName(v)})`,
      cloid: (v) => v.toString(),
    },
  },
  12: {
    name: 'Approve Builder Fee',
    description: '빌더 수수료 승인',
    params: ['uint64', 'address'],
    paramNames: ['maxFeeRate', 'builder'],
    formatters: {
      maxFeeRate: (v) => `${Number(v) / 10000}% (raw: ${v})`,
      builder: (v) => v,
    },
  },
  13: {
    name: 'Send Asset',
    description: '⚠️ 자산 전송 (자금 손실 주의)',
    params: ['address', 'address', 'uint32', 'uint32', 'uint64', 'uint64'],
    paramNames: ['dest', 'subAccount', 'srcDex', 'destDex', 'token', 'wei'],
    formatters: {
      dest: (v) => v,
      subAccount: (v) => v,
      srcDex: (v) => `DEX #${v}`,
      destDex: (v) => `DEX #${v}`,
      token: (v) => `Token #${v}`,
      wei: (v) => `${v} (raw)`,
    },
  },
  14: {
    name: 'Reflect EVM Supply',
    description: 'EVM 공급량 반영',
    params: ['uint64', 'uint64', 'bool'],
    paramNames: ['token', 'wei', 'isMint'],
    formatters: {
      token: (v) => `Token #${v}`,
      wei: (v) => `${v} (raw)`,
      isMint: (v) => v ? 'Mint' : 'Burn',
    },
  },
  15: {
    name: 'Borrow Lend Op',
    description: '대출/상환 (Testnet Only)',
    params: ['uint8', 'uint64', 'uint64'],
    paramNames: ['operation', 'token', 'wei'],
    formatters: {
      operation: (v) => getBorrowLendOpName(v),
      token: (v) => `Token #${v}`,
      wei: (v) => `${v} (raw)`,
    },
  },
};

// ============================================
// Helper Functions
// ============================================

function getAssetName(index) {
  const assets = {
    0: 'BTC', 1: 'ETH', 2: 'ATOM', 3: 'MATIC', 4: 'DYDX',
    5: 'SOL', 6: 'AVAX', 7: 'BNB', 8: 'APE', 9: 'OP',
    159: 'HYPE',
  };
  return assets[index] || `Asset #${index}`;
}

function getTifName(tif) {
  const tifs = {
    0: 'GTC (Good Till Cancel)',
    1: 'IOC (Immediate or Cancel)',
    2: 'ALO (Add Liquidity Only)',
  };
  return tifs[tif] || `TIF #${tif}`;
}

function getVariantName(variant) {
  const variants = {
    1: 'Create',
    2: 'First Storage Slot',
    3: 'Custom Storage Slot',
  };
  return variants[variant] || `Variant #${variant}`;
}

function getBorrowLendOpName(op) {
  const ops = {
    0: 'Deposit',
    1: 'Withdraw',
    2: 'Borrow',
    3: 'Repay',
  };
  return ops[op] || `Operation #${op}`;
}

// ============================================
// CoreWriter Decoder Class
// ============================================

class CoreWriterDecoder {
  constructor() {
    this.abiCoder = new ethers.AbiCoder();
  }

  /**
   * CoreWriter calldata를 디코딩합니다.
   * @param {string} calldata - 0x로 시작하는 hex string
   * @returns {Object} 디코딩된 결과
   */
  decode(calldata) {
    if (!calldata || !calldata.startsWith('0x')) {
      return { error: 'Invalid calldata format' };
    }

    try {
      const bytes = Buffer.from(calldata.slice(2), 'hex');

      if (bytes.length < 4) {
        return { error: 'Calldata too short' };
      }

      // Parse header
      const version = bytes[0];
      const actionId = (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
      const paramsHex = '0x' + bytes.slice(4).toString('hex');

      // Get action definition
      const actionDef = ACTION_DEFINITIONS[actionId];
      if (!actionDef) {
        return {
          version,
          actionId,
          actionName: `Unknown Action #${actionId}`,
          paramsRaw: paramsHex,
          error: 'Unknown action ID',
        };
      }

      // Decode parameters
      let decodedParams;
      try {
        decodedParams = this.abiCoder.decode(actionDef.params, paramsHex);
      } catch (e) {
        return {
          version,
          actionId,
          actionName: actionDef.name,
          description: actionDef.description,
          paramsRaw: paramsHex,
          error: `Failed to decode params: ${e.message}`,
        };
      }

      // Build formatted parameters
      const params = {};
      const formattedParams = {};

      for (let i = 0; i < actionDef.paramNames.length; i++) {
        const name = actionDef.paramNames[i];
        const value = decodedParams[i];
        params[name] = value;

        if (actionDef.formatters && actionDef.formatters[name]) {
          formattedParams[name] = actionDef.formatters[name](value);
        } else {
          formattedParams[name] = value.toString();
        }
      }

      return {
        version,
        actionId,
        actionName: actionDef.name,
        description: actionDef.description,
        params,
        formattedParams,
        paramsRaw: paramsHex,
      };
    } catch (e) {
      return { error: `Decode error: ${e.message}` };
    }
  }

  /**
   * 디코딩 결과를 보기 좋게 출력합니다.
   * @param {Object} decoded - decode() 결과
   * @returns {string} 포맷된 문자열
   */
  format(decoded) {
    if (decoded.error && !decoded.actionId) {
      return `❌ Error: ${decoded.error}`;
    }

    let output = [];
    output.push('═'.repeat(50));
    output.push(`📋 CoreWriter Action Decoded`);
    output.push('═'.repeat(50));
    output.push(`Version: ${decoded.version}`);
    output.push(`Action ID: ${decoded.actionId}`);
    output.push(`Action: ${decoded.actionName}`);
    output.push(`Description: ${decoded.description}`);
    output.push('─'.repeat(50));

    if (decoded.formattedParams) {
      output.push('Parameters:');
      for (const [name, value] of Object.entries(decoded.formattedParams)) {
        output.push(`  ${name}: ${value}`);
      }
    }

    if (decoded.error) {
      output.push('─'.repeat(50));
      output.push(`⚠️ Warning: ${decoded.error}`);
    }

    output.push('═'.repeat(50));
    return output.join('\n');
  }

  /**
   * JSON 형식으로 반환 (대시보드용)
   * @param {Object} decoded - decode() 결과
   * @returns {Object} JSON 형식
   */
  toJSON(decoded) {
    return {
      success: !decoded.error || !!decoded.actionId,
      version: decoded.version,
      actionId: decoded.actionId,
      actionName: decoded.actionName,
      description: decoded.description,
      params: decoded.formattedParams || {},
      rawParams: decoded.paramsRaw,
      error: decoded.error || null,
    };
  }

  /**
   * HTML 형식으로 반환 (웹 대시보드용)
   * @param {Object} decoded - decode() 결과
   * @returns {string} HTML 문자열
   */
  toHTML(decoded) {
    if (decoded.error && !decoded.actionId) {
      return `<div class="error">❌ ${decoded.error}</div>`;
    }

    let html = `
<div class="corewriter-decoded">
  <div class="header">
    <span class="action-id">Action #${decoded.actionId}</span>
    <span class="action-name">${decoded.actionName}</span>
  </div>
  <div class="description">${decoded.description}</div>
  <table class="params">
    <thead>
      <tr><th>Parameter</th><th>Value</th></tr>
    </thead>
    <tbody>`;

    if (decoded.formattedParams) {
      for (const [name, value] of Object.entries(decoded.formattedParams)) {
        html += `<tr><td>${name}</td><td>${value}</td></tr>`;
      }
    }

    html += `
    </tbody>
  </table>
</div>`;

    return html;
  }
}

// ============================================
// CLI Usage
// ============================================

async function main() {
  const decoder = new CoreWriterDecoder();

  console.log('='.repeat(60));
  console.log('CoreWriter Calldata Decoder');
  console.log('='.repeat(60));

  // Example calldatas from previous tests
  const examples = [
    {
      name: 'USD Class Transfer (Spot→Perp, 0.1 USD)',
      data: '0x0100000700000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000000000001',
    },
    {
      name: 'USD Class Transfer (Perp→Spot, 0.1 USD)',
      data: '0x0100000700000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000000000000',
    },
    {
      name: 'Limit Order (BTC Buy)',
      data: '0x010000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000002540be40000000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001234567890',
    },
    {
      name: 'Cancel Order by CLOID',
      data: '0x0100000b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000019bb3a1a200',
    },
    {
      name: 'Add API Wallet',
      data: '0x01000009000000000000000000000000a796b30fa453f958c02b7e2735171c31895e3ffe0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000001654657374576f6c6c65745f31373638363637323832323830000000000000000000',
    },
    {
      name: 'Approve Builder Fee',
      data: '0x0100000c00000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000001',
    },
  ];

  for (const example of examples) {
    console.log(`\n📌 ${example.name}`);
    console.log(`   Data: ${example.data.slice(0, 50)}...`);

    const decoded = decoder.decode(example.data);
    console.log(decoder.format(decoded));

    // JSON 출력 (대시보드용)
    console.log('\n📊 JSON (for dashboard):');
    console.log(JSON.stringify(decoder.toJSON(decoded), null, 2));
  }
}

// Export
module.exports = { CoreWriterDecoder, ACTION_DEFINITIONS };

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
