import { All, Controller, Headers, Req, Res } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { relay, type ProxiedRequest } from './relay';

const INVENTORY_PATH = /^\/api\/organizations\/[^/]+\/inventory(\/|$)/;

// Le stock d'une organisation vit dans inventory, le reste dans identity.
@Controller('organizations')
export class OrganizationController {
  @All(['', '*path'])
  forward(
    @Req() req: ProxiedRequest,
    @Headers('cookie') cookies: string | undefined,
    @Res() res: ServerResponse,
  ): Promise<void> {
    return relay(req, cookies, res, '/api/organizations', (pathname) =>
      INVENTORY_PATH.test(pathname)
        ? process.env.INVENTORY_SERVICE_URL
        : process.env.IDENTITY_SERVICE_URL,
    );
  }
}
