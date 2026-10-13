import { All, Controller, Headers, Req, Res } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { relay, type ProxiedRequest } from './relay';

const INVENTORY_PATH = /^\/api\/organizations\/[^/]+\/inventory(\/|$)/;
const PURCHASE_PATH = /^\/api\/organizations\/[^/]+\/purchases(\/|$)/;

// Le stock d'une organisation vit dans inventory, ses achats dans purchase,
// le reste dans identity.
@Controller('organizations')
export class OrganizationController {
  @All(['', '*path'])
  forward(
    @Req() req: ProxiedRequest,
    @Headers('cookie') cookies: string | undefined,
    @Res() res: ServerResponse,
  ): Promise<void> {
    return relay(req, cookies, res, '/api/organizations', (pathname) => {
      if (INVENTORY_PATH.test(pathname))
        return process.env.INVENTORY_SERVICE_URL;
      if (PURCHASE_PATH.test(pathname)) return process.env.PURCHASE_SERVICE_URL;
      return process.env.IDENTITY_SERVICE_URL;
    });
  }
}
