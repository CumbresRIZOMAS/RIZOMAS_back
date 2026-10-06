import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateEvidenceUploadUrlDto {
  @IsUUID()
  farmId: string;

  @IsString()
  @MaxLength(180)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.[a-zA-Z0-9]+$/, {
    message: 'fileName debe ser un nombre seguro con extensión',
  })
  fileName: string;

  @IsString()
  @MaxLength(120)
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: 'contentType debe ser un MIME válido' })
  contentType: string;
}

export class CreateEvidenceDownloadUrlDto {
  @IsString()
  @MaxLength(512)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.[a-zA-Z0-9]+$/, {
    message: 'objectKey debe ser una clave segura con extensión',
  })
  objectKey: string;
}
