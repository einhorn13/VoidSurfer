import { Selector } from '../behavior_tree/Selector.js';
import { Sequence } from '../behavior_tree/Sequence.js';
import { Condition } from '../behavior_tree/Condition.js';
import { Flee, NavigateToObjective, IsAtObjective, Loiter, Patrol } from './Actions.js';

export function createTraderBehavior() {
    return new Selector([
        // 1. Highest priority: Flee if under attack
        new Sequence([
            new Condition(bb => bb.targetId !== null),
            new Flee(),
        ]),

        // 2. If at the destination, loiter for a while
        new Sequence([
            new IsAtObjective(),
            new Loiter(),
        ]),

        // 3. If not at the destination, navigate towards it
        new NavigateToObjective(),

        // 4. Default behavior if no objective: Patrol randomly
        new Patrol(),
    ]);
}