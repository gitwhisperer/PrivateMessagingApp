import React, { useCallback, useEffect, useState } from 'react';
import { useWallet } from './wallet';
import { ro, cv, getNetwork, parseContract } from './stacks';
import { encrypt, generateKey } from './crypto';
import { principalCV, bufferCV, noneCV, stringAsciiCV } from '@stacks/transactions';
import { openContractCall } from '@stacks/connect';

// Light design system tokens
const palette = {
  bg: '#0e1116',
  surface: '#181d25',
  surfaceAlt: '#1f252f',
  border: '#2b323d',
  accent: '#4f8bff',
  accentHover: '#3a78f0',
  text: '#eef2f7',
  textDim: '#98a1b3',
  danger: '#ff5f56',
  success: '#3fb950',
  warn: '#f1b74d'
};

const cardStyle: React.CSSProperties = {
  background: palette.surface,
  border: `1px solid ${palette.border}`,
  borderRadius: 14,
  padding: '1.1rem 1.2rem',
  boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
  position: 'relative'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: palette.surfaceAlt,
  border: `1px solid ${palette.border}`,
  borderRadius: 8,
  padding: '0.6rem 0.75rem',
  color: palette.text,
  fontSize: 14,
  outline: 'none'
};

const buttonStyle: React.CSSProperties = {
  background: palette.accent,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '0.65rem 1.1rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 14,
  letterSpacing: 0.3
};

const smallButton: React.CSSProperties = { ...buttonStyle, padding: '0.4rem 0.75rem', fontSize: 12 };

const badge = (color: string) => ({
  display: 'inline-block',
  padding: '2px 8px',
  fontSize: 11,
  borderRadius: 999,
  background: color,
  color: '#fff',
  fontWeight: 600,
  letterSpacing: 0.5
} as React.CSSProperties);

interface InboxMessageMeta {
  id: number;
  ciphertext: string;
  media?: string;
  from: string;
  to: string;
  decrypted?: string | null;
}

const symKey = generateKey(); // ephemeral per-session demo key

export const App: React.FC = () => {
  const { address, signIn, signOut, userSession } = useWallet();
  const [inbox, setInbox] = useState<InboxMessageMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [plain, setPlain] = useState('');
  const [username, setUsername] = useState('');
  const [pubkey, setPubkey] = useState('');
  const [registering, setRegistering] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const countJson = await ro('get-inbox-count', [cv.principalCV(address)], address);
      const count = Number(countJson.value.value);
      const msgs: InboxMessageMeta[] = [];
      for (let i = 0; i < count; i++) {
        const idJson = await ro('get-inbox-message-id', [cv.principalCV(address), cv.uintCV(i)], address);
        const msgId = Number(idJson.value.value);
        const full = await ro('get-message', [cv.uintCV(msgId)], address);
        if (full.type === 'response' && full.value?.type === 'tuple') {
          const t = full.value.value;
          const cipherHex = t.ciphertext.value.substr(2); // remove 0x
          msgs.push({
            id: msgId,
            ciphertext: cipherHex,
            from: t.sender.value,
            to: t.recipient.value,
          });
        }
      }
      setInbox(msgs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  const handleSend = async () => {
    if (!address) return signIn();
    if (!recipient || !plain) return;
    // demo: encrypt with symmetric key (in real app derive from recipient pubkey)
    const { cipher } = encrypt(plain, symKey);
    // convert base64 cipher to bytes (truncate if needed)
    const bytes = Uint8Array.from(atob(cipher), c => c.charCodeAt(0)).slice(0, 512);
    const { address: contractAddress, name: contractName } = parseContract();
    await openContractCall({
      contractAddress,
      contractName,
      functionName: 'send-message',
  functionArgs: [principalCV(recipient), bufferCV(bytes), noneCV()],
      network: getNetwork(),
      appDetails: { name: import.meta.env.VITE_APP_NAME || 'PMA', icon: import.meta.env.VITE_APP_ICON || '' },
      onFinish: data => { setTxStatus(`Message tx submitted: ${data.txId}`); setPlain(''); setTimeout(loadInbox, 8000); },
      onCancel: () => console.log('send cancelled')
    });
  };

  const handleRegister = async () => {
    if (!address) return signIn();
    if (!username || !pubkey) return;
    const { address: contractAddress, name: contractName } = parseContract();
    setRegistering(true);
    try {
      await openContractCall({
        contractAddress,
        contractName,
        functionName: 'register',
        functionArgs: [stringAsciiCV(username), bufferCV(Buffer.from(pubkey, 'hex'))],
        network: getNetwork(),
        appDetails: { name: import.meta.env.VITE_APP_NAME || 'PMA', icon: import.meta.env.VITE_APP_ICON || '' },
        onFinish: data => { setTxStatus(`Register tx: ${data.txId}`); setTimeout(loadInbox, 6000); },
        onCancel: () => setTxStatus('Registration cancelled')
      });
    } catch (e:any) {
      console.error(e);
      setTxStatus(e.message);
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div style={{ background: `radial-gradient(circle at 20% 20%, #1d2530 0%, #0d1117 70%)`, minHeight: '100vh', color: palette.text, fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden' }}>
      {/* Global responsive & utility styles */}
      <style>{`
        * { box-sizing: border-box; }
        html, body { margin:0; padding:0; }
        body { -webkit-font-smoothing: antialiased; }
        @media (max-width: 760px) {
          .nav-bar { flex-direction: column; align-items: stretch !important; gap: 0.75rem !important; }
          .nav-bar .brand { justify-content: space-between; }
          .msg-grid { grid-template-columns: 1fr !important; }
        }
        .truncate { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .no-scrollbar::-webkit-scrollbar { width:8px; }
        .no-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .no-scrollbar::-webkit-scrollbar-thumb { background:#2c3642; border-radius:4px; }
      `}</style>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '1.1rem clamp(.9rem,2.2vw,1.4rem) 4rem' }}>
        <nav className="nav-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: '1.4rem', flexWrap: 'wrap' }}>
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: 0.5 }}>PMA</div>
            <div style={{ fontSize: 13, color: palette.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Private, on‑chain message metadata. Ciphertext only.</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            {!address ? (
              <button style={buttonStyle} onClick={signIn}>Connect Wallet</button>
            ) : (
              <>
                <div title={address} style={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' }}>{address}</div>
                <button style={{ ...smallButton, background: palette.surfaceAlt }} onClick={signOut}>Sign Out</button>
              </>
            )}
          </div>
        </nav>

        {txStatus && (
          <div style={{ marginBottom: 16, ...cardStyle, background: '#142033', borderColor: '#224466' }}>
            <div style={{ fontSize: 13 }}>{txStatus}</div>
          </div>
        )}

        <div className="msg-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: '1.25rem' }}>
          <section style={cardStyle}>
            <h3 style={{ margin: '0 0 .75rem', fontSize: 16 }}>Profile</h3>
            <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Username" value={username} maxLength={32} onChange={e => setUsername(e.target.value)} />
            <input style={{ ...inputStyle, marginBottom: 8, fontFamily: 'monospace' }} placeholder="Compressed pubkey (66 hex)" value={pubkey} onChange={e => setPubkey(e.target.value.trim())} />
            <button style={buttonStyle} onClick={handleRegister} disabled={!username || !/^0[23][0-9a-fA-F]{64}$/.test('0'+pubkey.slice(0)) || registering}>{registering ? 'Submitting…' : 'Register / Update'}</button>
            <p style={{ fontSize: 11, color: palette.textDim, lineHeight: 1.4, marginTop: 10 }}>Your compressed secp256k1 public key lets others encrypt for you. This demo does NOT yet derive keys; ciphertext uses a session key.</p>
          </section>

          <section style={cardStyle}>
            <h3 style={{ margin: '0 0 .75rem', fontSize: 16 }}>Send Message</h3>
            <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Recipient principal (ST...)" value={recipient} onChange={e => setRecipient(e.target.value.trim())} />
            <textarea style={{ ...inputStyle, height: 120, resize: 'vertical', marginBottom: 8 }} placeholder="Your secret message" value={plain} onChange={e => setPlain(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button style={buttonStyle} onClick={handleSend} disabled={!plain || !recipient}>Send</button>
              <span style={{ fontSize: 11, color: palette.textDim }}>{plain.length}/400</span>
            </div>
            <p style={{ fontSize: 11, color: palette.textDim, marginTop: 10 }}>Demo symmetric encryption only. Replace with E2E using recipient on‑chain pubkey for production.</p>
          </section>

          <section style={{ ...cardStyle, gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Inbox</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={smallButton} onClick={loadInbox} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                <span style={badge(palette.surfaceAlt)}>{inbox.length} msgs</span>
              </div>
            </div>
            {inbox.length === 0 && !loading && (
              <div style={{ fontSize: 13, color: palette.textDim }}>No messages yet. Send one from another wallet to see it here.</div>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10, maxHeight: 420, overflowY: 'auto' }} className="no-scrollbar">
              {inbox.map(m => (
                <li key={m.id} style={{ background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '0.75rem .9rem', minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: 13 }}>Message #{m.id}</strong>
                    <span style={{ ...badge(palette.accent), background: '#2d4e80' }}>cipher</span>
                  </div>
                  <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 4 }}>From {m.from.slice(0, 10)}…</div>
                  <code style={{ fontSize: 11, wordBreak: 'break-word', overflowWrap:'anywhere', color: palette.text, display: 'block', lineHeight: 1.3 }}>
                    {m.ciphertext.substring(0, 160)}{m.ciphertext.length > 160 && '…'}
                  </code>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <footer style={{ marginTop: 40, textAlign: 'center', fontSize: 11, color: palette.textDim }}>
          <span>© {new Date().getFullYear()} PMA Demo • Not production secure • Contract: {import.meta.env.VITE_CONTRACT_ADDRESS || 'unset'}</span>
        </footer>
      </div>
    </div>
  );
};
