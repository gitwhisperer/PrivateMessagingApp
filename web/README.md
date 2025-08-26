# PMA Web Front-End

React + Vite front-end for the Private Messaging App smart contract.

## Features
* Wallet connect (Leather) via `@stacks/connect`
* Register/send flow scaffold (register UI can be added similarly to send)
* Inbox pagination (basic – loads sequentially)
* Demo symmetric encryption placeholder (replace with real E2E)

## Setup
1. Copy `.env.example` to `.env` and set `VITE_CONTRACT_ADDRESS`.
2. Install deps:
   ```bash
   npm install
   npm run dev
   ```
3. Open http://localhost:5173

## Notes
* `send-message` currently uses a fake symmetric key; implement real encryption by:
  1. Fetching recipient profile (add `register` UI to store pubkey on-chain)
  2. Deriving shared secret (e.g., X25519 / secp256k1 ECDH) off-chain
  3. Encrypting with AEAD (XChaCha20-Poly1305) and posting ciphertext
* Add registration UI by calling contract function `register` with username + pubkey.
