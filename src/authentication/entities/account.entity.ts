
export enum AccountType {
    ACCOUNT_USER = "account_user",
    ACCOUNT_APP = "account_service"
}

export class Account {

    public id: string;
    public accountType: AccountType;
    public title: string;
    public description: string;
    public isListed: boolean;
    public accentColor: string;
    public clientId: string;
    public clientSecret: string;


}