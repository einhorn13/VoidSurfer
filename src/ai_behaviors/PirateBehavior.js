import { Selector } from '../behavior_tree/Selector.js';
import { Sequence } from '../behavior_tree/Sequence.js';
import { Condition } from '../behavior_tree/Condition.js';
import { FindBestTarget, Flee, AttackTarget, Patrol } from './Actions.js';

export function createPirateBehavior() {
    return new Selector([
        // Flee sequence
        new Sequence([
            new Condition(bb => bb.hullRatio < bb.config.fleeHealthThreshold),
            new Flee(),
        ]),
        // Attack sequence
        new Sequence([
            new FindBestTarget(),
            new AttackTarget(),
        ]),
        // Default behavior
        new Patrol(),
    ]);
}