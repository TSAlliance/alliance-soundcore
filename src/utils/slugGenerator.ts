import { RandomUtil } from "@tsalliance/rest";

export class Slug {

    public static create(input: string, length = 120): string {
        input = Slug.format(input);

        if(input.length > length) {
            return input.substring(0, length) + "-" + RandomUtil.randomString(6);
        } else {
            return input + "-" + RandomUtil.randomString(6);
        }
    }

    public static format(input: string): string {
        return `${input.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-")}`
    }


}