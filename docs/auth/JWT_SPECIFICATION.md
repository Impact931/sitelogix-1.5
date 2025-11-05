# JWT Token Specification for SiteLogix

## Overview
This document defines the complete JWT (JSON Web Token) structure, signing algorithm, and validation rules for SiteLogix authentication.

---

## Token Types

### 1. Access Token
**Purpose:** Short-lived token for API authentication
**Lifetime:** 15 minutes
**Storage:** httpOnly cookie (primary), memory (fallback)

### 2. Refresh Token
**Purpose:** Long-lived token for obtaining new access tokens
**Lifetime:** 30 days
**Storage:** httpOnly cookie only

---

## Access Token Structure

### Header
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "sitelogix-key-2024-01"
}
```

**Field Descriptions:**
- `alg`: Algorithm used (RS256 = RSA Signature with SHA-256)
- `typ`: Token type (always "JWT")
- `kid`: Key ID for key rotation support

### Payload
```json
{
  "sub": "user-550e8400-e29b-41d4-a716-446655440000",
  "email": "robert@sitelogix.com",
  "role": "SUPER_ADMIN",
  "permissions": [
    "user:create",
    "user:read:all",
    "user:update:all",
    "user:delete:all",
    "project:create",
    "project:read:all",
    "project:update:all",
    "project:delete",
    "report:create",
    "report:read:all",
    "report:update:all",
    "report:delete:all",
    "analytics:view:system",
    "analytics:export",
    "system:config"
  ],
  "name": "Robert Trask",
  "assignedProjects": [
    "proj-123",
    "proj-456"
  ],
  "metadata": {
    "lastLogin": 1699900000,
    "loginCount": 42,
    "preferredLanguage": "en"
  },
  "iat": 1699900000,
  "exp": 1699900900,
  "nbf": 1699900000,
  "iss": "sitelogix-api",
  "aud": "sitelogix-client",
  "jti": "token-550e8400-e29b-41d4-a716-446655440001"
}
```

**Standard Claims:**
- `sub` (Subject): User ID (UUID format)
- `iat` (Issued At): Unix timestamp when token was created
- `exp` (Expiration): Unix timestamp when token expires
- `nbf` (Not Before): Unix timestamp before which token is invalid
- `iss` (Issuer): Token issuer identifier
- `aud` (Audience): Intended token recipient
- `jti` (JWT ID): Unique token identifier for revocation

**Custom Claims:**
- `email`: User's email address
- `role`: User's role (SUPER_ADMIN | MANAGER | USER)
- `permissions`: Array of permission strings
- `name`: User's full name
- `assignedProjects`: Array of project IDs user has access to
- `metadata`: Additional user context data

### Signature
```
RSASHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  privateKey
)
```

---

## Refresh Token Structure

### Header
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "sitelogix-key-2024-01"
}
```

### Payload
```json
{
  "sub": "user-550e8400-e29b-41d4-a716-446655440000",
  "tokenId": "refresh-550e8400-e29b-41d4-a716-446655440002",
  "tokenFamily": "family-550e8400-e29b-41d4-a716-446655440003",
  "iat": 1699900000,
  "exp": 1702492000,
  "nbf": 1699900000,
  "iss": "sitelogix-api",
  "aud": "sitelogix-refresh",
  "type": "refresh"
}
```

**Custom Claims:**
- `tokenId`: Unique identifier for this specific refresh token
- `tokenFamily`: Identifier linking related refresh tokens (for rotation)
- `type`: Token type identifier ("refresh")

**Notes:**
- Refresh tokens contain minimal claims for security
- Token family ID used to detect token reuse attacks
- Audience differs from access token ("sitelogix-refresh")

---

## Token Lifetimes

| Token Type | Lifetime | Renewal | Storage |
|------------|----------|---------|---------|
| Access Token | 15 minutes | Via refresh token | httpOnly cookie + memory |
| Refresh Token | 30 days | On use (rotation) | httpOnly cookie only |

### Lifetime Rationale
- **15 minute access tokens:** Balance between security and UX
- **30 day refresh tokens:** Reasonable session duration
- **Rotation on use:** Prevents token reuse attacks

---

## Signing Algorithm

### RS256 (RSA with SHA-256)

**Why RS256 over HS256?**
1. **Asymmetric keys:** Public key for verification, private key for signing
2. **Key distribution:** Public key can be shared safely
3. **Multiple services:** Different services can verify without sharing secrets
4. **Key rotation:** Easier to rotate keys without downtime

### Key Generation
```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem
```

### Key Storage
- **Private Key:** AWS Secrets Manager
- **Public Key:** Distributed to all services
- **Key ID:** Used to identify which key signed the token

### Key Rotation Strategy
1. Generate new key pair
2. Add new public key to verification set
3. Start signing with new private key
4. Wait for old tokens to expire (30 days)
5. Remove old public key

---

## Token Validation

### Access Token Validation Steps

1. **Structural Validation**
```typescript
// Check token format (header.payload.signature)
const parts = token.split('.');
if (parts.length !== 3) {
  throw new Error('Invalid token structure');
}
```

2. **Signature Verification**
```typescript
import jwt from 'jsonwebtoken';

const publicKey = await getPublicKey(header.kid);
const decoded = jwt.verify(token, publicKey, {
  algorithms: ['RS256'],
  issuer: 'sitelogix-api',
  audience: 'sitelogix-client'
});
```

3. **Claims Validation**
```typescript
// Check expiration
if (Date.now() >= decoded.exp * 1000) {
  throw new Error('Token expired');
}

// Check not before
if (Date.now() < decoded.nbf * 1000) {
  throw new Error('Token not yet valid');
}

// Validate issuer
if (decoded.iss !== 'sitelogix-api') {
  throw new Error('Invalid issuer');
}

// Validate audience
if (decoded.aud !== 'sitelogix-client') {
  throw new Error('Invalid audience');
}
```

4. **Blacklist Check**
```typescript
const isBlacklisted = await checkTokenBlacklist(decoded.jti);
if (isBlacklisted) {
  throw new Error('Token revoked');
}
```

5. **User Status Check**
```typescript
const user = await getUserById(decoded.sub);
if (!user || !user.isActive || user.isLocked) {
  throw new Error('User account inactive');
}
```

### Refresh Token Validation Steps

1. **All access token validation steps** (with different audience)
2. **Token family verification**
```typescript
const storedToken = await getStoredRefreshToken(decoded.tokenId);
if (!storedToken || storedToken.tokenFamily !== decoded.tokenFamily) {
  // Token reuse detected - revoke entire family
  await revokeTokenFamily(decoded.tokenFamily);
  throw new Error('Token reuse detected');
}
```

3. **Single-use enforcement**
```typescript
// Mark token as used
await markTokenUsed(decoded.tokenId);
```

---

## Token Rotation (Refresh Token)

### Rotation Flow
```
Client requests refresh
    ↓
Validate current refresh token
    ↓
Mark current token as used
    ↓
Generate new access token
    ↓
Generate new refresh token (same family)
    ↓
Invalidate old refresh token
    ↓
Return new tokens
```

### Implementation
```typescript
async function refreshAccessToken(refreshToken: string) {
  // 1. Validate refresh token
  const decoded = await validateRefreshToken(refreshToken);

  // 2. Check if already used (reuse attack)
  const storedToken = await getStoredRefreshToken(decoded.tokenId);
  if (storedToken.used) {
    // Token reuse - revoke entire family
    await revokeTokenFamily(decoded.tokenFamily);
    throw new Error('Token reuse detected');
  }

  // 3. Mark as used
  await markTokenUsed(decoded.tokenId);

  // 4. Get user data
  const user = await getUserById(decoded.sub);

  // 5. Generate new tokens
  const newAccessToken = await generateAccessToken(user);
  const newRefreshToken = await generateRefreshToken(user, decoded.tokenFamily);

  // 6. Store new refresh token
  await storeRefreshToken({
    tokenId: newRefreshToken.jti,
    userId: user.id,
    tokenFamily: decoded.tokenFamily,
    expiresAt: newRefreshToken.exp
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
}
```

---

## Token Revocation

### Revocation Strategies

#### 1. Individual Token Revocation
```typescript
// Add token to blacklist
await addToBlacklist({
  tokenId: decoded.jti,
  userId: decoded.sub,
  expiresAt: decoded.exp,
  reason: 'user_logout'
});
```

#### 2. User-Level Revocation
```typescript
// Revoke all tokens for a user
await revokeAllUserTokens(userId, 'password_change');
```

#### 3. Token Family Revocation
```typescript
// Revoke entire refresh token family (security breach)
await revokeTokenFamily(tokenFamily, 'token_reuse_detected');
```

### Blacklist Implementation

**DynamoDB Table: TokenBlacklist**
```typescript
{
  tokenId: string;        // PK: Token JTI
  userId: string;         // GSI for user-level queries
  tokenFamily: string;    // GSI for family-level revocation
  expiresAt: number;      // TTL attribute (auto-delete)
  revokedAt: number;      // When token was revoked
  reason: string;         // Revocation reason
  ipAddress?: string;     // Where revocation occurred
}
```

**TTL Configuration:**
- DynamoDB TTL on `expiresAt` attribute
- Auto-deletes expired entries
- Keeps blacklist size manageable

---

## Token Size Optimization

### Current Size Estimate
```
Header:       ~100 bytes
Payload:      ~800 bytes
Signature:    ~256 bytes
Total:        ~1156 bytes (base64 encoded)
```

### Optimization Strategies

1. **Use Short Permission Codes**
```typescript
// Instead of: "user:read:all"
// Use: "u:r:a"
// Decode on backend
```

2. **Compress Permissions**
```typescript
// Instead of array of strings
permissions: ["user:create", "user:read", "user:update"]

// Use bitwise flags
permissions: 0b111 // Binary representation
```

3. **Omit Default Values**
```typescript
// Don't include fields with default values
// Add on backend if missing
```

4. **Separate Claims by Frequency**
```typescript
// Access token: Only frequently checked claims
// User profile endpoint: Rarely changing data
```

---

## Token Generation Examples

### Generate Access Token (Node.js)
```typescript
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';

const privateKey = readFileSync('private.pem', 'utf8');

function generateAccessToken(user: User): string {
  const permissions = ROLE_PERMISSIONS[user.role];

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    permissions,
    name: user.name,
    assignedProjects: user.assignedProjects,
    metadata: {
      lastLogin: user.lastLoginAt,
      loginCount: user.loginCount,
      preferredLanguage: user.preferredLanguage || 'en'
    }
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
    notBefore: '0',
    issuer: 'sitelogix-api',
    audience: 'sitelogix-client',
    jwtid: generateUUID(),
    keyid: 'sitelogix-key-2024-01'
  });
}
```

### Generate Refresh Token (Node.js)
```typescript
function generateRefreshToken(user: User, tokenFamily?: string): string {
  const family = tokenFamily || generateUUID();

  const payload = {
    sub: user.id,
    tokenId: generateUUID(),
    tokenFamily: family,
    type: 'refresh'
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '30d',
    issuer: 'sitelogix-api',
    audience: 'sitelogix-refresh',
    keyid: 'sitelogix-key-2024-01'
  });
}
```

### Verify Token (Node.js)
```typescript
import jwt from 'jsonwebtoken';

const publicKey = readFileSync('public.pem', 'utf8');

async function verifyAccessToken(token: string): Promise<TokenPayload> {
  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: 'sitelogix-api',
      audience: 'sitelogix-client',
      complete: false
    }) as TokenPayload;

    // Additional validation
    await validateTokenClaims(decoded);
    await checkBlacklist(decoded.jti);

    return decoded;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
}
```

---

## Cookie Configuration

### Access Token Cookie
```javascript
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: true,              // HTTPS only
  sameSite: 'strict',        // CSRF protection
  path: '/',
  maxAge: 15 * 60 * 1000,    // 15 minutes
  domain: '.sitelogix.com'   // Allow subdomains
});
```

### Refresh Token Cookie
```javascript
res.cookie('refreshToken', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/auth/refresh', // Only sent to refresh endpoint
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  domain: '.sitelogix.com'
});
```

---

## Security Considerations

### Token Theft Prevention
1. **httpOnly cookies:** JavaScript cannot access tokens
2. **Secure flag:** Only transmitted over HTTPS
3. **SameSite strict:** CSRF protection
4. **Short lifetimes:** Limit exposure window
5. **Token rotation:** Refresh tokens rotated on use

### Token Reuse Detection
```typescript
// Refresh token family tracking
// If old token used after new one issued → security breach
if (storedToken.used && storedToken.rotatedTo) {
  // Token reuse detected
  await revokeTokenFamily(storedToken.tokenFamily);
  await notifyUser(userId, 'Security Alert: Token Reuse Detected');
  await logSecurityEvent('TOKEN_REUSE', userId);
}
```

### XSS Protection
- Tokens never stored in localStorage
- httpOnly prevents JavaScript access
- CSP headers prevent inline script execution

### CSRF Protection
- SameSite cookies
- Double-submit cookie pattern (optional)
- Origin header validation

---

## Monitoring & Logging

### Metrics to Track
- Token generation rate
- Token validation failures
- Blacklist size
- Refresh token rotation rate
- Token reuse detections

### Security Alerts
```typescript
// Alert on suspicious patterns
if (failedValidations > 10 in last 5 minutes) {
  alert('High token validation failure rate');
}

if (tokenReuseDetected) {
  alert('Token reuse attack detected');
  revokeAllUserTokens(userId);
}

if (blacklistSize > 100000) {
  alert('Token blacklist size exceeding threshold');
}
```

---

## Testing

### Unit Tests
```typescript
describe('JWT Token Generation', () => {
  it('should generate valid access token', () => {
    const token = generateAccessToken(mockUser);
    const decoded = jwt.decode(token);

    expect(decoded.sub).toBe(mockUser.id);
    expect(decoded.role).toBe(mockUser.role);
    expect(decoded.iss).toBe('sitelogix-api');
  });

  it('should include all required claims', () => {
    const token = generateAccessToken(mockUser);
    const decoded = jwt.decode(token);

    expect(decoded).toHaveProperty('sub');
    expect(decoded).toHaveProperty('exp');
    expect(decoded).toHaveProperty('iat');
    expect(decoded).toHaveProperty('jti');
  });

  it('should expire after 15 minutes', () => {
    const token = generateAccessToken(mockUser);
    const decoded = jwt.decode(token);

    const expiryTime = decoded.exp * 1000;
    const expectedExpiry = Date.now() + (15 * 60 * 1000);

    expect(expiryTime).toBeCloseTo(expectedExpiry, -3);
  });
});
```

---

## References

- [RFC 7519: JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
- [RFC 7515: JSON Web Signature (JWS)](https://datatracker.ietf.org/doc/html/rfc7515)
- [RFC 8725: JWT Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
