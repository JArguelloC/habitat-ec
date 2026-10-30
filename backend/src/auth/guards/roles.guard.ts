import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.roles) {
      throw new ForbiddenException('Acceso denegado: usuario sin roles asignados.');
    }

    const tienePermiso = user.roles.some((rol: string) => requiredRoles.includes(rol));

    if (!tienePermiso) {
      throw new ForbiddenException(`Requiere uno de los siguientes roles: [${requiredRoles.join(', ')}]`);
    }

    return true;
  }
}