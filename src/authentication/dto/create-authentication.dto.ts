import { AccountType } from "../entities/account.entity";

export class CreateAuthenticationDTO {
    
    public identifier: string;
    public password: string;
    public clientId: string;
    public redirectUri: string;
    public accountType: AccountType;

}