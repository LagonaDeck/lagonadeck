import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { RequestUploadResponseDto } from './dto/request-upload-response.dto';
import { MediaAssetDto } from './dto/media-asset.dto';
import { ListMediaDto } from './dto/list-media.dto';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @ApiOperation({
    summary:
      "Demande une URL d'upload pré-signée pour un fichier (image ou document).",
    description:
      "Crée la métadonnée du média (statut PENDING) et renvoie son id ainsi qu'une URL " +
      "pré-signée sur laquelle le client doit effectuer un PUT direct du binaire. " +
      "L'id renvoyé est celui à conserver pour référencer ce fichier plus tard.",
  })
  @ApiResponse({ status: 201, type: RequestUploadResponseDto })
  requestUpload(
    @Body() dto: RequestUploadDto,
  ): Promise<RequestUploadResponseDto> {
    return this.mediaService.requestUpload(dto);
  }

  @Post(':id/confirm')
  @ApiOperation({
    summary: "Confirme qu'un upload a bien été déposé sur l'object storage.",
    description:
      "À appeler par le client une fois le PUT sur l'URL pré-signée terminé. " +
      'Vérifie la présence et la taille du binaire puis passe le média en statut READY.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du média' })
  @ApiResponse({ status: 200, type: MediaAssetDto })
  confirmUpload(@Param('id') id: string): Promise<MediaAssetDto> {
    return this.mediaService.confirmUpload(id);
  }

  @Get()
  @ApiOperation({ summary: 'Liste les médias, avec filtres optionnels.' })
  @ApiResponse({ status: 200, type: [MediaAssetDto] })
  findAll(@Query() query: ListMediaDto): Promise<MediaAssetDto[]> {
    return this.mediaService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupère la métadonnée d\'un média et son URL de téléchargement.',
    description:
      "L'URL de téléchargement pré-signée n'est renvoyée que si le média est READY.",
  })
  @ApiParam({ name: 'id', description: 'Identifiant du média' })
  @ApiResponse({ status: 200, type: MediaAssetDto })
  findOne(@Param('id') id: string): Promise<MediaAssetDto> {
    return this.mediaService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un média (métadonnée et binaire).' })
  @ApiParam({ name: 'id', description: 'Identifiant du média' })
  @ApiResponse({ status: 204 })
  remove(@Param('id') id: string): Promise<void> {
    return this.mediaService.remove(id);
  }
}
