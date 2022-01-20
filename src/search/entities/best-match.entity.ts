
export type SearchBestMatchType = "song" | "artist" | "album" | "genre" | "publisher" | "label" | "distributor" | "user"

export class SearchBestMatch {

    public type: SearchBestMatchType;
    public match: any;

}