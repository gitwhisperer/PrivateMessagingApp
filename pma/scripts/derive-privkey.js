/* derive-privkey.js
 * Derive a Stacks private key + address from a BIP39 mnemonic using @stacks/wallet-sdk
 * Default derivation path accounts: m/44'/5757'/0'/0/{ACCOUNT_INDEX}
 * Usage (PowerShell):
 *   $env:MNEMONIC="word1 word2 ..."; npm run derive:pk
 * Optional: $env:ACCOUNT_INDEX = "1" (defaults 0)
 * Output: JSON { privateKey, stxAddress, accountIndex, path }
 */
import { generateWallet } from '@stacks/wallet-sdk';

const mnemonic = process.env.MNEMONIC || '';
const accountIndex = parseInt(process.env.ACCOUNT_INDEX || '0', 10);
if (!mnemonic) {
  console.error('ERROR: MNEMONIC env var not set');
  process.exit(1);
}
if (Number.isNaN(accountIndex) || accountIndex < 0) {
  console.error('ERROR: ACCOUNT_INDEX must be a non-negative integer');
  process.exit(1);
}

try {
  const wallet = await generateWallet({ secretKey: mnemonic, password: '' });
  if (!wallet.accounts || wallet.accounts.length <= accountIndex) {
    console.error(`ERROR: Account index ${accountIndex} out of range (wallet has ${wallet.accounts.length} accounts)`);
    process.exit(1);
  }
  const acct = wallet.accounts[accountIndex];
  const path = `m/44'/5757'/0'/0/${accountIndex}`;
  // wallet-sdk returns stxPrivateKey in hex format already
  const out = {
    privateKey: acct.stxPrivateKey,
    stxAddress: acct.address,
    accountIndex,
    path
  };
  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  console.error('ERROR: Failed to derive keys:', e.message || e);
  process.exit(1);
}
