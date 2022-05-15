export type ResourceType = "song" | "user" | "playlist" | "album" | "collection" | "artist" | "genre" | "publisher" | "distributor" | "label" | "index" | "mount" | "bucket"

export interface Resource {
    id: string;
    name: string;
    slug: string;
    resourceType: ResourceType;
}