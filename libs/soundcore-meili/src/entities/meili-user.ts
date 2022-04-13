export class MeiliUser {
    public id: string;
    public username: string;

    public static attrs() {
        return ["username"]
    }
}