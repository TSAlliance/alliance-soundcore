import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard, KeycloakConnectModule, ResourceGuard, RoleGuard } from 'nest-keycloak-connect';
import { KeycloakConfigModule } from './config/keycloak-config.module';
import { KeycloakConfigService } from './config/keycloak-config.service';

@Module({
    imports: [
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
        }
    ]
})
export class KeycloakModule {

}