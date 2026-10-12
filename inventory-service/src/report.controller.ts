import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateReportDto,
  ListReportsDto,
  ReportDto,
  UpdateReportDto,
} from './report.dto';
import { ReportService } from './report.service';

// Déclaré avant `ProductController` : sinon `/products/reports` serait lu
// comme `/products/:productId`.
@ApiTags('reports')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Session invalide.' })
@Controller('products/reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @ApiOperation({
    summary: 'Signale un produit faux ou manquant à l’équipe LagonaDeck.',
  })
  @ApiResponse({ status: 201, type: ReportDto })
  @ApiResponse({ status: 404, description: 'Produit introuvable.' })
  create(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: CreateReportDto,
  ): Promise<ReportDto> {
    return this.reportService.create(authorization, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Signalements à traiter (équipe LagonaDeck).' })
  @ApiResponse({ status: 200, type: [ReportDto] })
  @ApiResponse({ status: 403, description: 'Réservé à l’équipe.' })
  list(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ListReportsDto,
  ): Promise<ReportDto[]> {
    return this.reportService.list(authorization, query.status ?? 'OPEN');
  }

  @Patch(':reportId')
  @ApiOperation({
    summary: 'Marque un signalement traité ou à traiter (équipe LagonaDeck).',
  })
  @ApiResponse({ status: 200, type: ReportDto })
  @ApiResponse({ status: 403, description: 'Réservé à l’équipe.' })
  @ApiResponse({ status: 404, description: 'Signalement introuvable.' })
  updateStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: UpdateReportDto,
  ): Promise<ReportDto> {
    return this.reportService.updateStatus(authorization, reportId, dto.status);
  }
}
