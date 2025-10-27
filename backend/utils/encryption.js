import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-32-chars-minimum';
const ALGORITHM = 'aes-256-gcm';

// Generate a random IV
const generateIV = () => randomBytes(16);

// Derive key from password
const deriveKey = async (password) => {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 32);
  return { key, salt };
};

// Encrypt data
export const encrypt = async (text) => {
  try {
    if (!text) return null;
    
    const iv = generateIV();
    const { key, salt } = await deriveKey(ENCRYPTION_KEY);
    
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine salt + iv + authTag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);
    
    return combined.toString('base64');
  } catch (error) {
    throw new Error('Encryption failed: ' + error.message);
  }
};

// Decrypt data
export const decrypt = async (encryptedData) => {
  try {
    if (!encryptedData) return null;
    
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const salt = combined.subarray(0, 16);
    const iv = combined.subarray(16, 32);
    const authTag = combined.subarray(32, 48);
    const encrypted = combined.subarray(48);
    
    // Derive key
    const key = await scryptAsync(ENCRYPTION_KEY, salt, 32);
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: ' + error.message);
  }
};

// Hash sensitive data for logging (one-way)
export const hashForLogging = async (data) => {
  if (!data) return null;
  
  const crypto = await import('crypto');
  return crypto.createHash('sha256')
    .update(data.toString())
    .digest('hex')
    .substring(0, 8); // First 8 chars for logging
};

// Sanitize data for logging
export const sanitizeForLogging = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitiveFields = [
    'password', 'email', 'phone', 'ssn', 'creditCard', 
    'token', 'secret', 'key', 'auth', 'session'
  ];
  
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }
  
  return sanitized;
};
