import { ApiProperty } from '@nestjs/swagger';

export class RequestUploadResponseDto {
  @ApiProperty({
    description:
      'Identifiant du média, à conserver pour référencer ce fichier plus tard (ex. depuis un autre service).',
  })
  id: string;

  @ApiProperty({
    description:
      "URL pré-signée à utiliser pour un PUT direct vers l'object storage.",
  })
  uploadUrl: string;

  @ApiProperty({ description: "Durée de validité de l'URL, en secondes." })
  expiresInSeconds: number;
}
