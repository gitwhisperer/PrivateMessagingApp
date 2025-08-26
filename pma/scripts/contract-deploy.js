/*
 * contract-deploy.js
 * Node-based fallback deployment for the private-messaging Clarity contract.
 *
 * Requirements:
 *  - ENV: DEPLOYER_SK  (Stacks private key for the deployer account - NEVER COMMIT!)
 *  - Optional ENV: FEE_RATE (ustx per byte) or MAX_FEE (explicit fee in ustx)
 *  - Optional ENV: NETWORK (default 'testnet')
 *  - Optional ENV: HIRO_API (override default Hiro API endpoint)
 *
 * Usage:
 *   DEPLOYER_SK=... node scripts/contract-deploy.js
 *   (On Windows PowerShell)
 *   $env:DEPLOYER_SK="your-priv-key"; node ./scripts/contract-deploy.js
 *
 * Output:
 *   JSON with { txid, contractId, explorer }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  makeContractDeploy,
  broadcastTransaction,
  estimateContractDeploy,
  AnchorMode,
} from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const networkName = process.env.NETWORK || 'testnet';
  const isTestnet = networkName !== 'mainnet';
  const HIRO_API = process.env.HIRO_API || (isTestnet ? 'https://api.testnet.hiro.so' : 'https://api.hiro.so');
  const DEPLOYER_SK = process.env.DEPLOYER_SK;
  const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  if (!DEPLOYER_SK) {
    console.error('ERROR: DEPLOYER_SK environment variable not set.');
    process.exit(1);
  }

  const contractName = 'private-messaging';
  const contractPath = path.join(__dirname, '..', 'contracts', `${contractName}.clar`);
  if (!fs.existsSync(contractPath)) {
    console.error(`ERROR: Contract file not found at ${contractPath}`);
    process.exit(1);
  }
  const source = fs.readFileSync(contractPath, 'utf8');

  const network = isTestnet ? new StacksTestnet({ url: HIRO_API }) : new StacksMainnet({ url: HIRO_API });

  // Fee strategy: explicit MAX_FEE, else estimate * multiplier fallback.
  const maxFeeEnv = process.env.MAX_FEE ? parseInt(process.env.MAX_FEE, 10) : undefined;
  let fee = maxFeeEnv;

  if (!fee) {
    try {
      const est = await estimateContractDeploy({
        contractName,
        codeBody: source,
        senderKey: DEPLOYER_SK,
        network,
      });
      // Add 20% safety margin
      fee = Math.ceil(est.estimation * 1.2);
      if (DRY_RUN) {
        console.log(JSON.stringify({ mode: 'DRY_RUN', estimatedFee: est.estimation, suggestedFee: fee }, null, 2));
        return; // Exit before building/broadcasting a transaction
      }
    } catch (e) {
      // fallback default fee
      fee = 5000; // ustx
    }
  }

  const tx = await makeContractDeploy({
    contractName,
    codeBody: source,
    senderKey: DEPLOYER_SK,
    network,
    anchorMode: AnchorMode.Any,
    fee,
  });

  const result = await broadcastTransaction(tx, network);
  if ('error' in result) {
    console.error('Broadcast failed:', result);
    process.exit(1);
  }

  const txid = result.txid;
  const contractId = `${tx.auth.spendingCondition?.signer}::${contractName}`;
  const explorer = isTestnet
    ? `https://explorer.hiro.so/txid/${txid}?chain=testnet`
    : `https://explorer.hiro.so/txid/${txid}`;

  const out = { txid, contractId, explorer, fee };
  console.log(JSON.stringify(out, null, 2));
}

main().catch(err => {
  console.error('Fatal error deploying contract:', err);
  process.exit(1);
});
