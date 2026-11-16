import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { errorMessage } from '../utils/form.util';
import { cardName, productDetails } from '../models/product';
import {
  formatPrice,
  formatTimestamp,
  hideBrokenImage,
} from '../utils/format.util';
import { Report } from '../models/report';
import { CatalogService } from '../services/catalog.service';

// Section réservée à l'équipe LagonaDeck : l'API refuse ces routes aux autres
// utilisateurs.
@Component({
  selector: 'app-management',
  templateUrl: './management.component.html',
  styleUrl: './management.component.css',
})
export class ManagementComponent {
  private readonly catalogService = inject(CatalogService);
  readonly status = signal<Report['status']>('OPEN');
  readonly date = formatTimestamp;
  readonly error = signal('');
  readonly cardName = cardName;
  readonly productDetails = productDetails;
  readonly formatPrice = formatPrice;
  readonly hideBrokenImage = hideBrokenImage;

  readonly reports = this.catalogService.reports(this.status);

  link(event: SubmitEvent, productId: string): void {
    event.preventDefault();
    const cardmarketId = Number(
      new FormData(event.target as HTMLFormElement).get('cardmarketId'),
    );
    this.run(this.catalogService.linkCardmarket(productId, cardmarketId));
  }

  setStatus(report: Report, status: Report['status']): void {
    this.run(this.catalogService.setReportStatus(report.id, status));
  }

  private run(request: Observable<unknown>): void {
    this.error.set('');
    request.subscribe({
      next: () => this.reports.reload(),
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }
}
