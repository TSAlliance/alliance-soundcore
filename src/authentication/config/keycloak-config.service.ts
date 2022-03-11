import { Injectable } from "@nestjs/common";
import { KeycloakConnectOptions, KeycloakConnectOptionsFactory, PolicyEnforcementMode, TokenValidation } from "nest-keycloak-connect";

@Injectable()
export class KeycloakConfigService implements KeycloakConnectOptionsFactory {

    createKeycloakConnectOptions(): KeycloakConnectOptions | Promise<KeycloakConnectOptions> {
        return {
            realm: process.env.KEYCLOAK_REALM,
            authServerUrl: process.env.KEYCLOAK_AUTH_SERVER_URL,
            clientId: process.env.KEYCLOAK_CLIENT_ID,
            secret: process.env.KEYCLOAK_CLIENT_SECRET,
            logLevels: [ "error", "log", "warn" ],
            useNestLogger: false,
            bearerOnly: true,
            policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
            tokenValidation: TokenValidation.ONLINE,
        }
    }
}