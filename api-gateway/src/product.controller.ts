import { All, Controller, Headers, Req, Res } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { relay, type ProxiedRequest } from './relay';

@Controller('products')
export class ProductController {
  @All(['', '*path'])
  forward(
    @Req() req: ProxiedRequest,
    @Headers('cookie') cookies: string | undefined,
    @Res() res: ServerResponse,
  ): Promise<void> {
    return relay(
      req,
      cookies,
      res,
      '/api/products',
      () => process.env.INVENTORY_SERVICE_URL,
    );
  }
}
