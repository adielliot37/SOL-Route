# Sol Route

A decentralized marketplace for encrypted digital files. Files are stored on Storacha (IPFS), payments via Solana blockchain, encryption keys managed with AWS KMS.

## How It Works

### Sellers

1. Upload a file with name, description, and price
2. File encrypted with AES-256-GCM, uploaded to Storacha
3. Encryption key wrapped with AWS KMS, stored in database
4. Listing appears on marketplace

### Buyers

1. Browse listings, connect Solana wallet
2. Purchase creates password-protected keypair
3. Send SOL (transaction includes order ID in memo)
4. After payment verified, receive decryption key
5. Download and decrypt file

## Technical Details

### Encryption Flow (Seller Side)

When a seller uploads a file:

**Step 1: Generate Content Key**
```
contentKey = crypto.randomBytes(32)  // 256-bit random key
```

**Step 2: Encrypt File**
```
iv = crypto.randomBytes(12)          // 96-bit nonce for GCM
encrypted = AES-256-GCM.encrypt(
  plaintext: fileData,
  key: contentKey,
  iv: iv,
  authTagLength: 128 bits
)
// Output: iv (12 bytes) + ciphertext + authTag (16 bytes)
```

**Step 3: Wrap Content Key with AWS KMS**
```
wrappedKey = KMS.encrypt(
  KeyId: process.env.KMS_KEY_ID,
  Plaintext: contentKey
)
// Returns: { CiphertextBlob, KeyId }
```

**Step 4: Store**
```
Storacha: encrypted file → returns CID
MongoDB: {
  cid: storachaCID,
  wrappedKey: base64(wrappedKey),
  kmsKeyId: KeyId,
  filename, size, mime
}
```

### Key Exchange (Buyer Side)

**Step 1: Generate Buyer Keypair**

When buyer clicks purchase:
```
password = user input
salt = crypto.randomBytes(16)

// Derive encryption key from password
passwordKey = PBKDF2(
  password: password,
  salt: salt,
  iterations: 310000,
  hash: SHA-256,
  keyLength: 256 bits
)

// Generate X25519 keypair (Curve25519)
buyerKeypair = sodium.crypto_box_keypair()
// Returns: { publicKey: 32 bytes, privateKey: 32 bytes }

// Encrypt private key with password-derived key
iv = crypto.randomBytes(12)
encryptedPrivateKey = AES-256-GCM.encrypt(
  plaintext: buyerKeypair.privateKey,
  key: passwordKey,
  iv: iv
)

// Store in localStorage
localStorage.set('x25519_pub_b64', base64(buyerKeypair.publicKey))
localStorage.set('x25519_enc_sec_b64', base64(iv + encryptedPrivateKey))
localStorage.set('x25519_salt_b64', base64(salt))
```

Send `buyerKeypair.publicKey` to server.

**Step 2: Payment Verification**

```
transaction = Solana.transfer({
  from: buyerWallet,
  to: sellerWallet,
  amount: priceLamports,
  memo: orderId  // Memo program instruction
})

Server verifies:
- Transaction exists on blockchain
- Memo matches orderId
- Amount matches listing price
- Not already processed
```

**Step 3: Key Delivery (Server Side)**

After payment verified:

```
// Unwrap content key from KMS
contentKey = KMS.decrypt(
  CiphertextBlob: listing.wrappedKey,
  KeyId: listing.kmsKeyId
)

// Generate ephemeral keypair for forward secrecy
ephemeralKeypair = sodium.crypto_box_keypair()

// Create shared secret using ECDH
sharedSecret = sodium.crypto_box_beforenm(
  buyerPublicKey,
  ephemeralKeypair.privateKey
)

// Encrypt content key to buyer
nonce = crypto.randomBytes(24)  // crypto_box_NONCEBYTES
sealedKey = sodium.crypto_box_easy(
  message: contentKey,
  nonce: nonce,
  publicKey: buyerPublicKey,
  secretKey: ephemeralKeypair.privateKey
)

// Return to buyer
response = {
  sealedKeyB64: base64(nonce + sealedKey),
  ephemeralPubB64: base64(ephemeralKeypair.publicKey)
}
```

### Decryption Flow (Buyer Side)

**Step 1: Recover Private Key**

```
password = user input
salt = base64decode(localStorage.get('x25519_salt_b64'))

// Re-derive password key
passwordKey = PBKDF2(
  password: password,
  salt: salt,
  iterations: 310000,
  hash: SHA-256,
  keyLength: 256 bits
)

// Decrypt private key
encryptedData = base64decode(localStorage.get('x25519_enc_sec_b64'))
iv = encryptedData.slice(0, 12)
ciphertext = encryptedData.slice(12)

buyerPrivateKey = AES-256-GCM.decrypt(
  ciphertext: ciphertext,
  key: passwordKey,
  iv: iv
)
```

**Step 2: Unseal Content Key**

```
// Parse sealed data
sealedData = base64decode(sealedKeyB64)
nonce = sealedData.slice(0, 24)
encryptedKey = sealedData.slice(24)

// Decrypt using X25519 + XSalsa20-Poly1305
contentKey = sodium.crypto_box_open_easy(
  ciphertext: encryptedKey,
  nonce: nonce,
  publicKey: ephemeralPublicKey,
  secretKey: buyerPrivateKey
)
// Returns 32-byte content key
```

**Step 3: Decrypt File**

```
// Fetch encrypted file from server
encryptedFile = fetch('/listings/' + id + '/file')
encrypted = base64decode(encryptedFile)

// Parse encrypted structure
iv = encrypted.slice(0, 12)
authTag = encrypted.slice(12, 28)
ciphertext = encrypted.slice(28)

// Import content key
key = crypto.subtle.importKey(
  'raw',
  contentKey,
  { name: 'AES-GCM' },
  false,
  ['decrypt']
)

// Decrypt file
plaintext = crypto.subtle.decrypt(
  {
    name: 'AES-GCM',
    iv: iv,
    tagLength: 128
  },
  key,
  concat(ciphertext, authTag)
)

// Download
blob = new Blob([plaintext], { type: originalMimeType })
downloadFile(blob, originalFilename)
```

## Security Properties

### Forward Secrecy

Each key delivery uses a fresh ephemeral keypair. If server is compromised later, past delivered keys cannot be recovered.

```
Session 1: ephemeralKey_1 (deleted after use)
Session 2: ephemeralKey_2 (deleted after use)
Session 3: ephemeralKey_3 (deleted after use)
```

Compromise of `ephemeralKey_3` does not affect sessions 1 or 2.

### Authentication

AES-GCM provides authenticated encryption. Any tampering with ciphertext causes decryption to fail:

```
ciphertext || authTag

Verification: GMAC(key, iv, ciphertext) == authTag
If false → reject decryption
```

### Key Isolation

Three separate key layers:

1. **Master Key** (AWS KMS): Never leaves AWS HSM
2. **Content Key** (per file): Wrapped by master key, stored encrypted
3. **User Private Key** (per buyer): Encrypted with password, stored in browser

Compromise of one layer doesn't compromise others.

### Password Protection

PBKDF2 with 310,000 iterations makes brute force expensive:

```
Attack cost = 310,000 iterations × password combinations
For 8-char password: ~10^14 operations
GPU: ~1 billion/sec → ~1 day per password
With good password: computationally infeasible
```

## Setup

### Frontend

```bash
cd storacha-market-ui
npm install
echo "NEXT_PUBLIC_API_BASE=http://localhost:3001" > .env
npm run dev
```

Open http://localhost:3000

### Backend

```bash
cd ..
npm install
```

Create `.env`:
```
# Server
PORT=3001
NODE_ENV=production
LOG_LEVEL=info

# Database
MONGODB_URI=mongodb://localhost:27017/storacha-market

# AWS KMS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
KMS_KEY_ID=arn:aws:kms:region:account:key/key-id

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
PAYMENT_WALLET=YourSolanaAddress

# Storacha/IPFS
STORACHA_BASE=http://localhost:3001/rest
W3UP_EMAIL=your@email.com
W3UP_SPACE=your_space_did


```

Run:
```bash
npm run dev
```

### AWS KMS

```bash
aws kms create-key --description "Sol Route Master Key"
aws kms enable-key-rotation --key-id $KEY_ID
```

### Storacha

1. Sign up at https://web3.storage
2. Create space, get credentials
3. Add to `.env`

## Tech Stack

**Frontend**
- Next.js 15
- Solana Wallet Adapter
- libsodium (X25519, XSalsa20-Poly1305)
- Web Crypto API (AES-GCM, PBKDF2)

**Backend**
- Express
- MongoDB
- AWS KMS
- Storacha MCP
- Solana Web3.js

**Cryptography**
- AES-256-GCM (file encryption)
- X25519 (ECDH key exchange)
- XSalsa20-Poly1305 (authenticated encryption for key delivery)
- PBKDF2 (password derivation)
- AWS KMS HSM (master key storage)

## API Endpoints

```
GET  /listings
GET  /listings/:id
GET  /listings/:id/file
POST /listings/create
POST /purchase/init
POST /delivery/verify-and-deliver
GET  /purchase/check/:listingId/:wallet
```

## Development Notes

- Use Solana devnet for testing
- Files on Storacha are permanent
- Encrypted files are public but useless without key
- Payment verified via Solana memo field
- Session expires after 1 hour

## License

ISC
