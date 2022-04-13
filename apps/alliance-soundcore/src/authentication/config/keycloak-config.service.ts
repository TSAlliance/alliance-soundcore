import { Injectable, LogLevel } from "@nestjs/common";
import { KeycloakConnectOptions, KeycloakConnectOptionsFactory, PolicyEnforcementMode, TokenValidation } from "nest-keycloak-connect";

@Injectable()
export class KeycloakConfigService implements KeycloakConnectOptionsFactory {

    createKeycloakConnectOptions(): KeycloakConnectOptions | Promise<KeycloakConnectOptions> {
        const logLevels: LogLevel[] = ["error", "log", "warn"];
        const isProduction: boolean = process.env.PRODUCTION == "true"
        let useNestLogger = false;

        if(isProduction) {
            logLevels.push("verbose")
            logLevels.push("debug")

            useNestLogger = true
        }

        return {
            realm: process.env.KEYCLOAK_REALM,
            authServerUrl: process.env.KEYCLOAK_AUTH_SERVER_URL,
            clientId: process.env.KEYCLOAK_CLIENT_ID,
            secret: process.env.KEYCLOAK_CLIENT_SECRET,
            logLevels,
            useNestLogger,
            bearerOnly: true,
            policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
            tokenValidation: TokenValidation.ONLINE,
        }
    }
}