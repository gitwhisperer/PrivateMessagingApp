import { Clarinet, Tx, Chain, Account, types } from "@hirosystems/clarinet-sdk";

const COMPRESSED_PUBKEY = "0279aabbccddeeff00112233445566778899aabbccddeeff0011223344556677";
const COMPRESSED_PUBKEY2 = "02ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

Clarinet.test({
  name: "User can register and send a message",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const sender = accounts.get("wallet_1")!;
    const recipient = accounts.get("wallet_2")!;
    let block = chain.mineBlock([
      Tx.contractCall("private-messaging","register", [types.ascii("alice"), types.buff(Buffer.from(COMPRESSED_PUBKEY, "hex"))], sender.address),
      Tx.contractCall("private-messaging","register", [types.ascii("bob"), types.buff(Buffer.from(COMPRESSED_PUBKEY2, "hex"))], recipient.address)
    ]);
    block.receipts.forEach(r => r.result.expectOk().expectBool(true));
    const sendBlock = chain.mineBlock([
      Tx.contractCall("private-messaging","send-message", [types.principal(recipient.address), types.buff(Buffer.from("aa", "hex")), types.none()], sender.address)
    ]);
    sendBlock.receipts[0].result.expectOk();
  }
});

Clarinet.test({
  name: "Outsider cannot read ciphertext",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const a1 = accounts.get("wallet_1")!;
    const a2 = accounts.get("wallet_2")!;
    const outsider = accounts.get("wallet_3")!;
    chain.mineBlock([
      Tx.contractCall("private-messaging","register", [types.ascii("alice"), types.buff(Buffer.from(COMPRESSED_PUBKEY, "hex"))], a1.address),
      Tx.contractCall("private-messaging","register", [types.ascii("bob"), types.buff(Buffer.from(COMPRESSED_PUBKEY2, "hex"))], a2.address)
    ]);
    chain.mineBlock([
      Tx.contractCall("private-messaging","send-message", [types.principal(a2.address), types.buff(Buffer.from("aa", "hex")), types.none()], a1.address)
    ]);
    let attempt = chain.callReadOnlyFn("private-messaging","get-message", [types.uint(1)], outsider.address);
    attempt.result.expectErr();
  }
});