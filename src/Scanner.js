// src/Scanner.js
export class Scanner {
    constructor() {
        this.targets = [];
        this.navTarget = null;
        this.targetIndex = -1;
        this.playerShip = null; // Store a reference to the player ship
    }

    update(playerShip, allShips) {
        this.playerShip = playerShip; // Update reference each frame
        this.targets = [];
        allShips.forEach(ship => {
            if (ship !== playerShip && !ship.isDestroyed) {
                const distance = playerShip.mesh.position.distanceTo(ship.mesh.position);
                this.targets.push({ ship, distance });
            }
        });
        
        this.targets.sort((a, b) => a.distance - b.distance);

        if (this.navTarget && this.navTarget.isDestroyed) {
            this.navTarget = null;
            this.targetIndex = -1;
        }
    }

    setNavTarget(target) {
        this.navTarget = target;
    }

    cycleTarget(allShips, playerShip) {
        const potentialTargets = allShips.filter(s => s !== playerShip && !s.isDestroyed);
        if (potentialTargets.length === 0) {
            this.navTarget = null;
            this.targetIndex = -1;
            return;
        }

        this.targetIndex++;
        if (this.targetIndex >= potentialTargets.length) {
            this.targetIndex = 0;
        }
        this.setNavTarget(potentialTargets[this.targetIndex]);
    }
}