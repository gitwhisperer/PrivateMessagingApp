;; Private Messaging App Smart Contract
;; A reference implementation inspired by the sample fungible token contract you provided.
;; NOTE: All message bodies are stored ON-CHAIN as ciphertext. Anyone can see ciphertext
;; but (if you use strong off-chain encryption) only intended parties can decrypt.
;; Never store plain text sensitive data on-chain.

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Constants & Errors
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(define-constant err-already-registered (err u100))
(define-constant err-not-registered (err u101))
(define-constant err-invalid-username (err u102))
(define-constant err-invalid-pubkey (err u103))
(define-constant err-empty-ciphertext (err u104))
(define-constant err-not-participant (err u105))
(define-constant err-index-out-of-range (err u106))
(define-constant err-invalid-recipient (err u107))
(define-constant err-message-not-found (err u108))

;; Adjustable limits (can be tuned before deployment)
(define-constant MAX-USERNAME-LEN u32)
(define-constant PUBKEY-LEN u33)                ;; Compressed secp256k1 public key length suggestion
(define-constant MAX-CIPHERTEXT-LEN u512)       ;; Arbitrary example size cap

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Data Structures
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; Registered users: maps principal -> { username, pubkey }
(define-map users principal
  {
    username: (string-ascii 32),
    pubkey: (buff 33)
  })

;; Global auto-increment message id counter
(define-data-var message-counter uint u0)

;; Messages: id -> data
;; media-hash can store e.g. IPFS / Arweave hash bytes (up to 32) or omitted
(define-map messages uint
  {
    sender: principal,
    recipient: principal,
    ciphertext: (buff 512),
    media-hash: (optional (buff 32)),
    block-height: uint
  })

;; Per-user inbox indexing: (recipient, index) -> message-id
(define-map inbox-index { user: principal, idx: uint } uint)
;; Per-user sent indexing: (sender, index) -> message-id
(define-map sent-index { user: principal, idx: uint } uint)

;; Track counts for quick O(1) length retrieval
(define-map inbox-counts principal uint)
(define-map sent-counts principal uint)

;; Read receipts: (message-id, reader) -> bool (true means reader marked as read)
(define-map read-receipts { id: uint, user: principal } bool)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Internal Helpers
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-private (is-registered (p principal))
  (is-some (map-get? users p)))

(define-private (assert-registered (p principal))
  (asserts! (is-registered p) err-not-registered))

(define-private (increment-counter)
  (let ((current (var-get message-counter)))
    (var-set message-counter (+ current u1))
    (+ current u1)))  ;; return new id

(define-private (inbox-count-of (p principal))
  (default-to u0 (map-get? inbox-counts p)))

(define-private (sent-count-of (p principal))
  (default-to u0 (map-get? sent-counts p)))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Public Functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; Register a new user with a username and public key for off-chain encryption.
(define-public (register (username (string-ascii 32)) (pubkey (buff 33)))
  (begin
    (asserts! (not (is-registered tx-sender)) err-already-registered)
    (asserts! (> (len username) u0) err-invalid-username)
    (asserts! (<= (len username) MAX-USERNAME-LEN) err-invalid-username)
    (asserts! (is-eq (len pubkey) PUBKEY-LEN) err-invalid-pubkey)
    (map-set users tx-sender { username: username, pubkey: pubkey })
    (ok true)))

;; Update existing profile (username and/or pubkey)
(define-public (update-profile (new-username (optional (string-ascii 32))) (new-pubkey (optional (buff 33))))
  (let ((user-data (map-get? users tx-sender)))
    (match user-data existing
      (let (
            (username (default-to (get username existing) new-username))
            (pubkey   (default-to (get pubkey existing) new-pubkey))
           )
        (asserts! (> (len username) u0) err-invalid-username)
        (asserts! (<= (len username) MAX-USERNAME-LEN) err-invalid-username)
        (asserts! (is-eq (len pubkey) PUBKEY-LEN) err-invalid-pubkey)
        (map-set users tx-sender { username: username, pubkey: pubkey })
        (ok true))
      (err err-not-registered))) )

;; Send an encrypted message to a registered recipient.
;; ciphertext must already be encrypted off-chain with recipient's pubkey.
;; media-hash is optional metadata pointer.
(define-public (send-message (recipient principal) (ciphertext (buff 512)) (media-hash (optional (buff 32))))
  (begin
    (asserts! (not (is-eq recipient tx-sender)) err-invalid-recipient)
    (assert-registered tx-sender)
    (assert-registered recipient)
    (asserts! (> (len ciphertext) u0) err-empty-ciphertext)
    (asserts! (<= (len ciphertext) MAX-CIPHERTEXT-LEN) err-empty-ciphertext)
    (let ((new-id (increment-counter))
          (sender tx-sender)
          (bh block-height)
          (recipient-inbox-count (inbox-count-of recipient))
          (sender-sent-count (sent-count-of sender)))
      (map-set messages new-id { sender: sender, recipient: recipient, ciphertext: ciphertext, media-hash: media-hash, block-height: bh })
      (map-set inbox-index { user: recipient, idx: recipient-inbox-count } new-id)
      (map-set sent-index { user: sender, idx: sender-sent-count } new-id)
      (map-set inbox-counts recipient (+ recipient-inbox-count u1))
      (map-set sent-counts sender (+ sender-sent-count u1))
      (print { event: "message-sent", id: new-id, from: sender, to: recipient })
      (ok new-id))))

;; Mark message as read by a participant (sender or recipient)
(define-public (mark-read (id uint))
  (let ((maybe (map-get? messages id)))
    (match maybe m
      (begin
        (asserts! (or (is-eq tx-sender (get sender m)) (is-eq tx-sender (get recipient m))) err-not-participant)
        (map-set read-receipts { id: id, user: tx-sender } true)
        (ok true))
      err-message-not-found)))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Read-Only Functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; Get registered profile data (public) - returns public key so clients can encrypt
(define-read-only (get-profile (user principal))
  (map-get? users user))

;; Get counts

;; Exposed read-only wrappers (renamed private helpers above to avoid collision)
(define-read-only (get-inbox-count (user principal))
  (ok (inbox-count-of user)))

(define-read-only (get-sent-count (user principal))
  (ok (sent-count-of user)))

;; Resolve message id from a user's inbox index
(define-read-only (get-inbox-message-id (user principal) (index uint))
  (let ((count (inbox-count-of user)))
    (if (>= index count)
        err-index-out-of-range
        (ok (default-to u0 (map-get? inbox-index { user: user, idx: index }))))))

;; Resolve message id from a user's sent index
(define-read-only (get-sent-message-id (user principal) (index uint))
  (let ((count (sent-count-of user)))
    (if (>= index count)
        err-index-out-of-range
        (ok (default-to u0 (map-get? sent-index { user: user, idx: index }))))))

;; Get a message (ciphertext only visible to participants)
(define-read-only (get-message (id uint))
  (let ((maybe (map-get? messages id)))
    (match maybe m
      (if (or (is-eq tx-sender (get sender m)) (is-eq tx-sender (get recipient m)))
          (ok {
                id: id,
                sender: (get sender m),
                recipient: (get recipient m),
                ciphertext: (get ciphertext m),
                media-hash: (get media-hash m),
                block-height: (get block-height m),
                read-by-sender: (is-some (map-get? read-receipts { id: id, user: (get sender m) })),
                read-by-recipient: (is-some (map-get? read-receipts { id: id, user: (get recipient m) }))
              })
          err-not-participant)
      err-message-not-found)))

;; Lightweight metadata view (public) WITHOUT ciphertext; shows only routing info
(define-read-only (get-message-metadata (id uint))
  (let ((maybe (map-get? messages id)))
    (match maybe m
      (ok {
            id: id,
            sender: (get sender m),
            recipient: (get recipient m),
            media-hash: (get media-hash m),
            block-height: (get block-height m)
          })
      err-message-not-found)))

;; Convenience: check if a message is marked read by caller
(define-read-only (is-read (id uint))
  (ok (is-some (map-get? read-receipts { id: id, user: tx-sender }))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Notes:
;; - For true privacy, only store encrypted blobs here.
;; - Consider off-chain indexing / pagination beyond simple counters for scale.
;; - Media should be stored off-chain (IPFS/Arweave/etc.) and referenced by hash.
;; - Deletion / retention policies can be implemented by additional functions
;;   that either tombstone entries or emit revocation events (cannot actually
;;   erase on-chain data once stored).
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
