import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  async createUploadUrl(objectKey: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket(),
      Key: objectKey,
      ContentType: contentType,
    });

    return {
      objectKey,
      url: await getSignedUrl(this.clientForR2(), command, { expiresIn: this.expirySeconds() }),
      expiresIn: this.expirySeconds(),
    };
  }

  async createDownloadUrl(objectKey: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket(),
      Key: objectKey,
    });

    return {
      objectKey,
      url: await getSignedUrl(this.clientForR2(), command, { expiresIn: this.expirySeconds() }),
      expiresIn: this.expirySeconds(),
    };
  }

  /** Lee un objeto (para la moderación automática). Rechaza archivos de más de 15 MB. */
  async getObject(objectKey: string, maxBytes = 15 * 1024 * 1024) {
    const response = await this.clientForR2().send(new GetObjectCommand({ Bucket: this.bucket(), Key: objectKey }));
    if (response.ContentLength !== undefined && response.ContentLength > maxBytes) {
      throw new Error(`El objeto ${objectKey} supera el tamaño máximo para moderación`);
    }
    if (!response.Body) throw new Error(`El objeto ${objectKey} está vacío`);
    return { body: Buffer.from(await response.Body.transformToByteArray()), contentType: response.ContentType };
  }

  private clientForR2() {
    if (this.client) return this.client;

    const endpoint = this.required('R2_ENDPOINT');
    const accessKeyId = this.required('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.required('R2_SECRET_ACCESS_KEY');

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    return this.client;
  }

  private bucket() {
    return this.required('R2_BUCKET');
  }

  private expirySeconds() {
    const configured = Number(this.config.get<string>('R2_SIGNED_URL_TTL_SECONDS') ?? 900);
    if (!Number.isInteger(configured) || configured < 60 || configured > 3600) {
      throw new ServiceUnavailableException('R2_SIGNED_URL_TTL_SECONDS debe estar entre 60 y 3600 segundos');
    }
    return configured;
  }

  private required(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value || value.startsWith('replace-with-') || value.includes('<')) {
      throw new ServiceUnavailableException(`Configuración de almacenamiento incompleta: ${name}`);
    }
    return value;
  }
}
