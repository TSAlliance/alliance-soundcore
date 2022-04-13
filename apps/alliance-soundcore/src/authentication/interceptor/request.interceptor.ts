import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { UserService } from "../../user/user.service";
import { KeycloakUser } from "../entities/keycloak-user.entity";

@Injectable()
export class RequestInterceptor implements NestInterceptor {

    constructor(
        private userService: UserService
    ) {}
    
    public async intercept(context: ExecutionContext, next: CallHandler<any>): Promise<Observable<any>> {
        // See: https://github.com/ferrerojosh/nest-keycloak-connect/blob/master/src/guards/auth.guard.ts
        // Under:
        // Attach user info object
        // request.user = parseToken(jwt);
        const request = context.switchToHttp()?.getRequest();
        if(request.user) {
            request.user = await this.userService.findOrCreateByKeycloakUserInstance(request.user as KeycloakUser)
        }

        return next.handle();
    }

}