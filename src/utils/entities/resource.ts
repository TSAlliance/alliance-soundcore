export type ResourceType = "notification" | "artwork" | "song" | "user" | "playlist" | "album" | "collection" | "artist" | "genre" | "publisher" | "distributor" | "label" | "index" | "mount" | "bucket"

export interface Resource {
    id: string;
    name: string;
    resourceType: ResourceType;
}