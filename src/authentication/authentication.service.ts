import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { CreateAuthenticationDTO } from './dto/create-authentication.dto';
import { CreateAuthorizationDTO } from './dto/create-authorization.dto';
import { Account, AccountType } from './entities/account.entity';
import { AccessTokenResponse } from './responses/access-token.response';
import { GrantCodeResponse } from './responses/grant-code.response';

@Injectable()
export class AuthenticationService {
    private context = "AllianceSSO";
    private logger: Logger = new Logger(this.context);
    private ssoBaseUrl = process.env.SSO_URL;
    private redirectUri = "http://localhost:3001"

    private _currentAccount: Account = null;

    constructor() {
        const createAuthenticationDto: CreateAuthenticationDTO = {
            clientId: process.env.SSO_CLIENT_ID,
            identifier: process.env.SSO_CLIENT_ID,
            password: process.env.SSO_CLIENT_SECRET,
            redirectUri: this.redirectUri,
            accountType: AccountType.ACCOUNT_APP
        }

        this.logger.log(`Authenticating app with credentials on '${this.ssoBaseUrl}'`);

        axios.post<GrantCodeResponse>(`${this.ssoBaseUrl}/authentication/authenticate`, createAuthenticationDto).then((grantCodeRes) => {
            const createAuthorizationDto: CreateAuthorizationDTO = {
                grantCode: grantCodeRes.data.grantCode,
                redirectUri: this.redirectUri
            }
            
            axios.post<AccessTokenResponse>(`${this.ssoBaseUrl}/authentication/authorize`, createAuthorizationDto).then((accessTokenRes) => {
                axios.get<Account>(`${this.ssoBaseUrl}/services/@me`, { headers: { "Authorization": `Bearer ${accessTokenRes.data?.accessToken}` } }).then((response) => {
                    this._currentAccount = {
                        ...this._currentAccount,
                        ...response.data
                    }

                    this.logger.log(`Authenticated app as '${this._currentAccount.title}'`)
                }).catch((reason) => this.handleError(reason))
            }).catch((reason) => this.handleError(reason))
            

        }).catch((reason) => this.handleError(reason));
    }

    private async handleError(error: AxiosError): Promise<void> {
        this.logger.error(`Could not authenticate this app with sso service at '${this.ssoBaseUrl}': `);

        if(error.isAxiosError) {
            this.logger.error(`Request failed with code ${error.response?.status || 400}: ${error.response?.data["message"] || "Internal client error"}. (${error.config.url})`)
        } else {
            this.logger.error(error);
        }
    }
}
