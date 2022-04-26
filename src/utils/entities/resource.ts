export type ResourceType = "artwork" | "song" | "user" | "playlist" | "album" | "collection" | "artist" | "genre" | "publisher" | "distributor" | "label" | "index" | "mount" | "bucket"

export interface Resource {
    id: string;
    resourceType: ResourceType
}