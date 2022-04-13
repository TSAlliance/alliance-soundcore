
export interface SoundcoreMeiliIndex {
    name: string;
    primaryKey?: string;
    searchAttrs?: string[];
}
export interface SoundcoreMeiliConfig {
    host: string;
    port: number;
    key?: string;
    indexes?: SoundcoreMeiliIndex[];
}