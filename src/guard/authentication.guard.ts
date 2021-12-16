import { CanActivate, ExecutionContext, Injectable, Scope, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AccountNotFoundException, InsufficientPermissionException, PROPERTY_PERMISSION_META_KEY } from "@tsalliance/rest";
import { SSOService, SSOUser } from "@tsalliance/sso-nest";
import { Observable } from "rxjs";
import { SSORole } from "./sso-role.entity";

@Injectable({ scope: Scope.REQUEST })
export class AuthenticationGuard implements CanActivate {

  constructor(private reflector: Reflector, private authService: SSOService) {}

  canActivate(ctx: ExecutionContext): boolean | Promise < boolean > | Observable < boolean > {
    return new Promise(async (resolve, reject) => {
      try {
        const metaValue: string[] | boolean = this.reflector.get<string[] | boolean>(PROPERTY_PERMISSION_META_KEY, ctx.getHandler());
        const requiredPermissions: string[] = [];

        if(typeof metaValue != "undefined" && metaValue != null) {
          if(typeof metaValue == "boolean") {
            // @CanAccess(false) --> No one can access this route
            if(!metaValue) throw new InsufficientPermissionException();
          } else {
            requiredPermissions.push(...metaValue);
          }
        }
        
        const isRouteRequiringPermission: boolean = requiredPermissions?.length > 0 || false;
        const headers: any = ctx.switchToHttp().getRequest().headers;
        const authHeaderValue: string = headers["authorization"]
        const hasScopedParams: boolean = this.hasScopeParameter(ctx);
        const isRouteRequiringAuth: boolean = isRouteRequiringPermission || hasScopedParams

        if(!isRouteRequiringAuth) {
          if(!authHeaderValue) {
            resolve(true)
            return;
          }
        }

        // If no header exists and authentication is needed 
        // ==> throw unauthorized
        if(!authHeaderValue && isRouteRequiringAuth) {
          throw new UnauthorizedException()
        }

        // Proceed with authentication and authorization
        // Even if route does not required authentication, a request
        // is authenticated if a header was found.
        // Decode access token and validate it to retrieve account data
        const account: SSOUser = await this.authService.findCurrentUserByHeader(authHeaderValue);

        // Make authentication object available to future actions in the handler chain
        // The @Authentication param decorator as an example uses this to return the authentication
        // object.
        ctx.switchToHttp().getRequest().authentication = account;

        // If account is null but authentication is required
        // ==> throw AccountNotFoundError
        if(!account) {
          if(isRouteRequiringAuth) throw new AccountNotFoundException();
          // otherwise continue and resolve at bottom of this inner function
        } else {
          // This variable contains a boolean value.
          // Evaluates to TRUE, if a @me scope was found on the url. This results in requiring the user to be authenticated, but he passes all permission checks.
          this.translateScopedParam(ctx)
          
          if(isRouteRequiringPermission && !hasScopedParams) {
            // If there are multiple permissions set, it means OR.
            // So only one permission must be granted to successfully proceed.
            const permissionGranted = !!requiredPermissions.find((permission) => (account.role as SSORole).permissions.includes(permission));

            if(!permissionGranted) {
              throw new InsufficientPermissionException();
            }
          }
        }

        resolve(true)
      } catch (err) {
        reject(err)
      }
    });
  }

  /**
   * Translate @me params to actual account id
   * @param ctx ExecutionContext
   * @returns True or False. True if there was a @me scope.
   */
  private translateScopedParam(ctx: ExecutionContext) {
    const params = ctx.switchToHttp().getRequest().params;
    const account = ctx.switchToHttp().getRequest().authentication;

    for(const key in params) {
      if(params[key].toString().toLowerCase() == "@me") {
        params[key] = account.id
      }
    }
  }

  /**
   * Check if route includes parameters with scoped value (eg.: @me).
   * @param ctx ExecutionContext.
   * @returns boolean
   */
  private hasScopeParameter(ctx: ExecutionContext): boolean {
    const params = ctx.switchToHttp().getRequest().params as Record<string, any>;
    // console.log(params)

    // console.log("found " +Object.values(params).filter((paramVal: string) => paramVal.includes("@me")).length + " scoped params")
    return Object.values(params).filter((paramVal: string) => paramVal.includes("@me")).length > 0;
  }
}
