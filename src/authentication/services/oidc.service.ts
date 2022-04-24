import { Inject, Injectable } from "@nestjs/common";
import { Client, Issuer } from "openid-client";
import { OIDCConfig } from "../config/oidc.config";
import { OIDC_OPTIONS } from "../oidc.constants";

@Injectable()
export class OIDCService {

    private _issuer: Issuer;
    private _client: Client;

    constructor(
        @Inject(OIDC_OPTIONS) private readonly options: OIDCConfig
    ) {}

    public async discoverIssuer() {
        this._issuer = await Issuer.discover(`${this.options.server_base_url}/realms/${this.options.realm}`)
        this._client = new this._issuer.Client({
            client_id: this.options.client_id,
            client_secret: this.options.client_secret,
            redirect_uris: [this.options.redirect_uri],
            response_types: ["code"]
        })

        return this._client.issuer.metadata;
    }

    public client(): Client {
        return this._client;
    }

    public issuer(): Issuer {
        return this._issuer;
    }

}