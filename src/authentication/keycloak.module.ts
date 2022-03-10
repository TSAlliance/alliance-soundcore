import { Module } from '@nestjs/common';
import { KeycloakConnectModule } from 'nest-keycloak-connect';

@Module({
    imports: [
        KeycloakConnectModule.register({
            realm: process.env.KEYCLOAK_REALM,
            authServerUrl: process.env.KEYCLOAK_AUTH_SERVER_URL,
            clientId: process.env.KEYCLOAK_CLIENT_ID,
            secret: process.env.KEYCLOAK_CLIENT_SECRET
        })
    ]
})
export class KeycloakModule {}