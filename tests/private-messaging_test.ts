import { Clarinet, Tx, Chain, Account, types } from "@hirosystems/clarinet-sdk";

// Helper constants
const COMPRESSED_PUBKEY = "0279aabbccddeeff00112233445566778899aabbccddeeff0011223344556677"; // 33 bytes
const COMPRESSED_PUBKEY2 = "02ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"; // 33 bytes

Clarinet.test({
  name: "User can register profile and send a message (basic flow)",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const sender = accounts.get("wallet_1")!;
    const recipient = accounts.get("wallet_2")!;

    // Register sender
    let block = chain.mineBlock([
      Tx.contractCall(
        "private-messaging",
        "register",
        [types.ascii("alice"), types.buff(Buffer.from(COMPRESSED_PUBKEY, "hex"))],
        sender.address
      ),
      Tx.contractCall(
        "private-messaging",
        "register",
        [types.ascii("bob"), types.buff(Buffer.from(COMPRESSED_PUBKEY2, "hex"))],
        recipient.address
      )
    ]);
  block.receipts.forEach((r: any) => r.result.expectOk().expectBool(true));

    // Send message from sender -> recipient
    const ct = "112233445566"; // ciphertext sample (hex) shorter than MAX
    let sendBlock = chain.mineBlock([
      Tx.contractCall(
        "private-messaging",
        "send-message",
        [
          types.principal(recipient.address),
          types.buff(Buffer.from(ct, "hex")),
          types.none(),
        ],
        sender.address
      )
    ]);
    const msgReceipt = sendBlock.receipts[0];
    msgReceipt.result.expectOk();
  const msgId = (msgReceipt.result as any).value; // Not strongly typed in harness

    // Inbox count for recipient should be 1
    let inboxCount = chain.callReadOnlyFn(
      "private-messaging",
      "get-inbox-count",
      [types.principal(recipient.address)],
      recipient.address
    );
    inboxCount.result.expectOk().expectUint(1);

    // Fetch message metadata (public) and full message as participant
    let fullMsg = chain.callReadOnlyFn(
      "private-messaging",
      "get-message",
      [types.uint(1)],
      recipient.address
    );
    fullMsg.result.expectOk();
  }
});

Clarinet.test({
  name: "Non-participant cannot view ciphertext of another message",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const a1 = accounts.get("wallet_1")!;
    const a2 = accounts.get("wallet_2")!;
    const outsider = accounts.get("wallet_3")!;

    chain.mineBlock([
  Tx.contractCall("private-messaging","register", [types.ascii("alice"), types.buff(Buffer.from(COMPRESSED_PUBKEY, "hex"))], a1.address),
  Tx.contractCall("private-messaging","register", [types.ascii("bob"), types.buff(Buffer.from(COMPRESSED_PUBKEY2, "hex"))], a2.address)
    ]);

    chain.mineBlock([
      Tx.contractCall(
        "private-messaging","send-message",
        [types.principal(a2.address), types.buff(Buffer.from("aa", "hex")), types.none()],
        a1.address
      )
    ]);

    let attempt = chain.callReadOnlyFn(
      "private-messaging","get-message", [types.uint(1)], outsider.address
    );
    attempt.result.expectErr(); // Should error with err-not-participant
  }
});
