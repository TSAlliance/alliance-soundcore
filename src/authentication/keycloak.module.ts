import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard, KeycloakConnectModule, ResourceGuard, RoleGuard } from 'nest-keycloak-connect';
import { UserModule } from '../user/user.module';
import { KeycloakConfigModule } from './config/keycloak-config.module';
import { KeycloakConfigService } from './config/keycloak-config.service';
import { RequestInterceptor } from './interceptor/request.interceptor';

@Module({
    imports: [
        UserModule,
        KeycloakConnectModule.registerAsync({
            useExisting: KeycloakConfigService,
            imports: [ KeycloakConfigModule ]
        })
    ],
    providers: [
        KeycloakConfigService,
        {
            provide: APP_GUARD,
            useClass: AuthGuard, // This forces users to be authenticated.
        },
        {
            provide: APP_GUARD,
            useClass: ResourceGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RoleGuard,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: RequestInterceptor,
        }
    ]
})
export class KeycloakModule {

}