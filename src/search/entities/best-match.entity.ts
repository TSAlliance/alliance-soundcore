
export type SearchBestMatchType = "song" | "artist" | "album" | "genre" | "publisher" | "label" | "distributor"

export class SearchBestMatch {

    public type: SearchBestMatchType;
    public match: any;

}