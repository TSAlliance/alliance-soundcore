
export class UploadCreatedEvent {
    public id: string;
    public filepath: string;

    constructor(id: string, filepath: string){
        this.id = id;
        this.filepath = filepath;
    }
}