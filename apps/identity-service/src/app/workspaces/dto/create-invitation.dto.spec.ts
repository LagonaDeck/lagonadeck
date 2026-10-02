import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WorkspaceRole } from '../../../generated/prisma/enums';
import { CreateInvitationDto } from './create-invitation.dto';

async function validateDto(payload: Record<string, unknown>) {
  return validate(plainToInstance(CreateInvitationDto, payload));
}

describe('CreateInvitationDto', () => {
  it('invite en MEMBER par défaut', async () => {
    const dto = plainToInstance(CreateInvitationDto, {
      email: 'jane@example.com',
    });
    expect(dto.role).toBe(WorkspaceRole.MEMBER);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejette le rôle OWNER, qui se transfère sans invitation', async () => {
    const errors = await validateDto({
      email: 'jane@example.com',
      role: WorkspaceRole.OWNER,
    });
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it("normalise l'email (espaces retirés, minuscules) avant validation", async () => {
    const dto = plainToInstance(CreateInvitationDto, {
      email: '  Jane@Example.com  ',
    });
    expect(dto.email).toBe('jane@example.com');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejette un email au mauvais format', async () => {
    const errors = await validateDto({ email: 'pas-un-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});
