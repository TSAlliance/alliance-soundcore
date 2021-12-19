
export enum FileStatus {

    STATUS_DUPLICATE = "duplicate",
    STATUS_PROCESSING = "processing",
    STATUS_AVAILABLE = "available",
    STATUS_UNAVAILABLE = "unavailable",
    STATUS_LOOKUP_LYRICS = "lookup_lyrics",
    STATUS_ERRORED = "errored",
    // This happens, if ffmpeg throwed error but entry in database was created.
    // This exists to inform users.
    STATUS_CORRUPTED = "corrupted"

}