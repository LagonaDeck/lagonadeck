import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { InvitationsController } from './invitations.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  controllers: [WorkspacesController, InvitationsController],
  providers: [WorkspacesService],
})
export class WorkspacesModule {}
