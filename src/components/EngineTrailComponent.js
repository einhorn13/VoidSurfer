// src/components/EngineTrailComponent.js
import { Component } from '../ecs/Component.js';
import { EngineTrail } from './EngineTrail.js';
import { serviceLocator } from '../ServiceLocator.js';

export class EngineTrailComponent extends Component {
    constructor() {
        super();
        const scene = serviceLocator.get('Scene');
        this.trailInstance = new EngineTrail(scene);
    }
}