import crypto, {Cipher, Decipher} from 'crypto';
const algorithm = 'aes-256-cbc';

export class CryptoHelper {

  public static encrypt(key: string, text: string): string {
    const encryptedKey: string = crypto.createHash('md5').update(key).digest('hex');
    const cipher: Cipher = crypto.createCipheriv(algorithm, Buffer.from(encryptedKey), encryptedKey.substr(0,16));
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  public static decrypt(key: string, text: string): string {
    const encryptedKey: string = crypto.createHash('md5').update(key).digest('hex');
    const decipher: Decipher = crypto.createDecipheriv(algorithm, Buffer.from(encryptedKey), encryptedKey.substr(0,16));
    let decrypted = decipher.update(text,'hex', 'utf8');
    decrypted +=  decipher.final('utf8');
    return decrypted;
  }

}
