import * as Stx from '@stacks/transactions';
const { deserializeCV, cvToJSON, stringAsciiCV, principalCV, uintCV, bufferCV, Cl } = Stx as any;

export const getNetwork = () => {
  const net = import.meta.env.VITE_STACKS_NETWORK || 'testnet';
  const coreApiUrl = net === 'mainnet' ? 'https://api.hiro.so' : 'https://api.testnet.hiro.so';
  return { coreApiUrl } as any; // minimal network interface for openContractCall
};

export const parseContract = () => {
  const full = import.meta.env.VITE_CONTRACT_ADDRESS as string;
  if (!full) throw new Error('Contract address missing');
  const [address, name] = full.split('::');
  return { address, name };
};

export async function ro(name: string, args: any[], sender: string) {
  const net = getNetwork();
  const { address, name: contractName } = parseContract();
  const url = `${net.coreApiUrl}/v2/contracts/call-read/${address}/${contractName}/${name}`;
  const body = {
    sender: sender,
    arguments: args.map(a => {
      const bytes: Uint8Array = Cl.serializeCV ? Cl.serializeCV(a) : Stx.serializeCV(a);
      return '0x' + Buffer.from(bytes).toString('hex');
    }),
  };
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`RO failed ${resp.status}`);
  const json = await resp.json();
  const hex = json.result.slice(2); // strip 0x
  const cvBuffer = Buffer.from(hex, 'hex');
  const clarityVal = deserializeCV(cvBuffer);
  return cvToJSON(clarityVal);
}

export const cv = { stringAsciiCV, principalCV, uintCV, bufferCV };
