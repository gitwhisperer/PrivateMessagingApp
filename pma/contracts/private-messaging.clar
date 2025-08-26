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
(define-constant PUBKEY-LEN u33)
(define-constant MAX-CIPHERTEXT-LEN u512)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Data Structures
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-map users principal { username: (string-ascii 32), pubkey: (buff 33) })
(define-data-var message-counter uint u0)
(define-map messages uint { sender: principal, recipient: principal, ciphertext: (buff 512), media-hash: (optional (buff 32)), block-height: uint })
(define-map inbox-index { user: principal, idx: uint } uint)
(define-map sent-index { user: principal, idx: uint } uint)
(define-map inbox-counts principal uint)
(define-map sent-counts principal uint)
(define-map read-receipts { id: uint, user: principal } bool)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Internal Helpers
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-private (increment-counter) (let ((current (var-get message-counter))) (var-set message-counter (+ current u1)) (+ current u1)))
(define-private (inbox-count-of (p principal)) (default-to u0 (map-get? inbox-counts p)))
(define-private (sent-count-of (p principal)) (default-to u0 (map-get? sent-counts p)))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Public Functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (register (username (string-ascii 32)) (pubkey (buff 33)))
  (begin
    (asserts! (not (is-some (map-get? users tx-sender))) err-already-registered)
    (asserts! (> (len username) u0) err-invalid-username)
    (asserts! (<= (len username) MAX-USERNAME-LEN) err-invalid-username)
    (asserts! (is-eq (len pubkey) PUBKEY-LEN) err-invalid-pubkey)
    (map-set users tx-sender { username: username, pubkey: pubkey })
    (ok true)))

(define-public (update-profile (new-username (optional (string-ascii 32))) (new-pubkey (optional (buff 33))))
  (begin
    (asserts! (is-some (map-get? users tx-sender)) err-not-registered)
    (let ((existing (unwrap-panic (map-get? users tx-sender)))
          (username (match new-username u (some u) (some (get username existing))))
          (pub (match new-pubkey k (some k) (some (get pubkey existing)))))
      (let ((final-username (unwrap-panic username)) (final-pub (unwrap-panic pub)))
        (asserts! (> (len final-username) u0) err-invalid-username)
        (asserts! (<= (len final-username) MAX-USERNAME-LEN) err-invalid-username)
        (asserts! (is-eq (len final-pub) PUBKEY-LEN) err-invalid-pubkey)
        (map-set users tx-sender { username: final-username, pubkey: final-pub })
        (ok true)))))

(define-public (send-message (recipient principal) (ciphertext (buff 512)) (media-hash (optional (buff 32))))
  (begin
    (asserts! (not (is-eq recipient tx-sender)) err-invalid-recipient)
    (asserts! (is-some (map-get? users tx-sender)) err-not-registered)
    (asserts! (is-some (map-get? users recipient)) err-not-registered)
    (asserts! (> (len ciphertext) u0) err-empty-ciphertext)
    (asserts! (<= (len ciphertext) MAX-CIPHERTEXT-LEN) err-empty-ciphertext)
    (let ((new-id (increment-counter)) (sender tx-sender) (bh block-height) (recipient-inbox-count (inbox-count-of recipient)) (sender-sent-count (sent-count-of sender)))
      (map-set messages new-id { sender: sender, recipient: recipient, ciphertext: ciphertext, media-hash: media-hash, block-height: bh })
      (map-set inbox-index { user: recipient, idx: recipient-inbox-count } new-id)
      (map-set sent-index { user: sender, idx: sender-sent-count } new-id)
      (map-set inbox-counts recipient (+ recipient-inbox-count u1))
      (map-set sent-counts sender (+ sender-sent-count u1))
      (print { event: "message-sent", id: new-id, from: sender, to: recipient })
      (ok new-id))))

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

(define-read-only (get-profile (user principal)) (map-get? users user))
(define-read-only (get-inbox-count (user principal)) (ok (inbox-count-of user)))
(define-read-only (get-sent-count (user principal)) (ok (sent-count-of user)))
(define-read-only (get-inbox-message-id (user principal) (index uint)) (let ((count (inbox-count-of user))) (if (>= index count) err-index-out-of-range (ok (default-to u0 (map-get? inbox-index { user: user, idx: index }))))) )
(define-read-only (get-sent-message-id (user principal) (index uint)) (let ((count (sent-count-of user))) (if (>= index count) err-index-out-of-range (ok (default-to u0 (map-get? sent-index { user: user, idx: index }))))) )
(define-read-only (get-message (id uint)) (let ((maybe (map-get? messages id))) (match maybe m (if (or (is-eq tx-sender (get sender m)) (is-eq tx-sender (get recipient m))) (ok { id: id, sender: (get sender m), recipient: (get recipient m), ciphertext: (get ciphertext m), media-hash: (get media-hash m), block-height: (get block-height m), read-by-sender: (is-some (map-get? read-receipts { id: id, user: (get sender m) })), read-by-recipient: (is-some (map-get? read-receipts { id: id, user: (get recipient m) })) }) err-not-participant) err-message-not-found)))
(define-read-only (get-message-metadata (id uint)) (let ((maybe (map-get? messages id))) (match maybe m (ok { id: id, sender: (get sender m), recipient: (get recipient m), media-hash: (get media-hash m), block-height: (get block-height m) }) err-message-not-found)))
(define-read-only (is-read (id uint)) (ok (is-some (map-get? read-receipts { id: id, user: tx-sender }))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Notes
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; - Store only ciphertext; encryption is off-chain.
;; - Pagination uses simple counters; scale solutions may require off-chain indexers.
;; - Media should be referenced by hash.
;; - Data is immutable - implement tombstones/events for logical deletions.
