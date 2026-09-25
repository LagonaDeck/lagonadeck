import { ApiProperty } from '@nestjs/swagger';

export class RequestUploadResponseDto {
  @ApiProperty({
    description:
      'Identifiant du média, à conserver pour référencer ce fichier plus tard (ex. depuis un autre service).',
  })
  id: string;

  @ApiProperty({
    description:
      "URL cible du POST multipart/form-data à effectuer directement vers l'object storage.",
  })
  uploadUrl: string;

  @ApiProperty({
    description:
      'Champs à envoyer tels quels dans le formulaire multipart, avant le champ `file` (qui doit être le dernier). ' +
      "Ils figent notamment le Content-Type et la taille exacte annoncés : l'upload est rejeté par l'object storage " +
      'si le fichier envoyé ne correspond pas exactement à ce qui a été déclaré.',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      'Content-Type': 'application/pdf',
      bucket: 'lagonadeck-media',
      key: 'document/owner-1/85cf5d17-.../85cf5d17-...',
      Policy: '...',
      'X-Amz-Signature': '...',
    },
  })
  uploadFields: Record<string, string>;

  @ApiProperty({ description: "Durée de validité de l'URL, en secondes." })
  expiresInSeconds: number;
}
