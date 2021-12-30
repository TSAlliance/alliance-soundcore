import { Injectable } from '@nestjs/common';
import { Label } from './entities/label.entity';
import { LabelRepository } from './repositories/label.repository';

@Injectable()
export class LabelService {

    constructor(private lableRepository: LabelRepository){}

    /**
     * Create new label by name if it does not already exist in the database.
     * @param name Name of the label
     * @param geniusId Id to the GENIUS entry (handled by genius as "artist") (optional)
     * @returns Label
     */
    public async createIfNotExists(name: string, geniusId?: string): Promise<Label> {
        const label: Label = await this.lableRepository.findOne({ where: { name }})
        if(label) return label;

        return this.lableRepository.save({
            name,
            geniusId
        })
    }

}
