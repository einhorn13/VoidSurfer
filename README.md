# Void Surfer v 0.3 (ELITE-inspired HTML5 game)

A lightweight 3D space combat and exploration game built with JavaScript and Three.js, running entirely in the browser. This project is inspired by classic space simulators, focusing on fast-paced dogfights and dynamic world events.

![Void Surfer](https://github.com/user-attachments/assets/766a9092-d780-4ba6-81c7-0c2149ee6a3c)


## Key Features

*   **Simple Newtonian Flight Model:** Experience a flight model with acceleration and inertia.
*   **Dynamic Universe:** The world is populated by a dynamic spawner system, creating continuous encounters with pirates and civilians.
*   **ECS Architecture:** Built on a robust **Entity Component System** architecture, making the game logic modular, performant, and easily extensible.
*   **Procedural Content:** Ships and asteroids are generated procedurally, allowing for a wide variety of assets.
*   **Loot & Economy:** Destroy pirates to earn bounty rewards and collect salvage from wreckage to build your wealth.
*   **Ship Customization:** Visit space stations to repair, rearm, and purchase new, more powerful ships.

## Credits

This project was developed with significant contributions from AI assistants. The breakdown of contributions to the code and architecture is as follows:

*   **rest - @Einhorn13**
*   **75% - Google Gemini**
*   **5% - Qwen Family Models**
*   **5% - OpenAI GPT 5 Models** 

## Controls

The game is controlled via keyboard and mouse.

| Key(s)               | Action              |
| :------------------- | :------------------ |
| **W, S / Arrow Keys**  | Pitch (Up/Down)     |
| **A, D / Arrow Keys**  | Yaw (Left/Right)    |
| **Q, E**             | Roll                |
| **Shift**            | Accelerate          |
| **J**                | Boost               |
| **Spacebar**         | Fire Primary Weapon |
| **Mouse+Left click**   | Aim Ship            |
| **G**                | Dock with Station   |
| **T**                | Cycle Target        |
| **Escape**           | Deselect Target     |
| **\`** (Backtick)    | Open Console        |
| **1, 2, 3...**       | Select Weapon Group |

## How to Run

1.  Clone the repository.
2.  You need a local web server to run the game due to browser security policies (CORS). A simple way is to use Python's built-in server:
    ```bash
    # From the project's root directory
    python -m http.server
    ```
3.  Open your browser and navigate to `http://localhost:8000`.

---

## Changelog - v0.3

**Key Features**

*   **Workshop & Inventory:** Added a Workshop to the station services. Players can now buy, sell, and equip different weapons, engines, and shields to customize their ship. An inventory now stores unequipped modules.
*   **Interactive System Map:** A new interactive, zoomable system map has been added (default key 'M'). It displays celestial bodies, zones of interest, and detected ships. Players can set navigation targets directly from the map.
*   **Tactical Minimap:** A new minimap has been integrated into the HUD, providing at-a-glance information about nearby contacts, their altitude relative to the player, and allegiance.
*   **Drift Mechanic:** A new "Drift" ability has been added, allowing for advanced combat maneuvers by temporarily disabling flight assist.

**AI Overhaul**

*   **Behavior Tree System:** The entire AI has been rewritten from a simple state machine to a much more complex and dynamic Behavior Tree system.
*   **Distinct AI Personalities:** Ships now have unique AI behaviors (e.g., `trader`, `interceptor`, `gunship`) with different parameters for engagement range, evasion, and weapon usage.
*   **Advanced Combat Tactics:** AI now actively performs collision avoidance, attempts to maintain an optimal combat range, evades incoming fire, and uses more intelligent targeting logic.

**World & Gameplay**

*   **Dynamic World Zones:** The game world is now divided into distinct zones (e.g., Station Traffic Zone, Asteroid Belts) with unique encounter types.
*   **Squad-Based Spawning:** Enemies and civilians now spawn in logical squads (e.g., a freighter with interceptor escorts, or a pirate hunting party) based on the zone's dynamically calculated threat level.
*   **Improved Flight Model:** Players can now use strafe controls for more precise lateral movement. The physics simulation now runs at a fixed timestep for more consistent behavior.

**UI & UX**

*   **Input System Refactor:** The input handling has been completely rebuilt to be more robust, responsive, and ready for future keybinding customization.
*   **Enhanced Navigation UI:** Added off-screen indicators to always keep track of the current navigation target, whether it's on-screen or not.
*   **Improved Target Display:** The target information panel is now more detailed, showing faction, relation (hostile/neutral/friendly), and speed.
*   **Performance UI:** World-space UI elements (like target brackets and the crosshair) are now rendered on a high-performance canvas instead of using slower DOM elements.

**Performance & Stability**

*   **Object Pooling:** Implemented object pooling for projectiles, damage numbers, and NPC ships. This significantly reduces stuttering and improves performance during intense combat by recycling objects instead of creating and destroying them.

## Changelog - v0.2

Version 0.2 represents a complete architectural rewrite of the project, migrating from a traditional Object-Oriented Programming (OOP) model to a modern **Entity Component System (ECS)**. This fundamental change provides massive improvements in performance, flexibility, and code organization.

### :rocket: **Major Architectural Changes**

*   **Full ECS Migration:** The old class-based system (`Ship.js`, `Asteroid.js`, `EnemyAI.js`) has been completely replaced by a pure ECS architecture.
    *   **Components:** Logic-less data containers (e.g., `HealthComponent`, `PhysicsComponent`).
    *   **Systems:** Global systems that operate on entities with specific components (e.g., `MovementSystem`, `DamageSystem`, `AISystem`).
    *   **Entities:** Simple IDs that tie components together.
*   **Centralized Event Bus:** Decoupled communication between systems is now handled by a global `EventBus` and a frame-specific ECS event queue.
*   **Assembler Pattern:** Entity creation is now managed by a robust `EntityAssembler` factory, ensuring all entities are created with a valid set of components.

### :sparkles: **New Features & Gameplay Enhancements**

*   **Bounty & Salvage System:**
    *   Destroying pirates now grants an instant **Bounty** reward, shared proportionally based on damage dealt.
    *   All destroyed ships can now drop physical **Salvage Containers** with credits and items that must be collected.
*   **Dynamic Spawning:** The world is now persistent, with an `DynamicSpawner` that continuously creates and despawns ships around the player.
*   **Shipyard & Purchases:** Players can now visit a station's shipyard to purchase new ships with their earned credits.
*   **Enhanced AI:** The old `EnemyAI` class has been replaced by a modular state-machine-based `AISystem` (`AttackingState`, `FleeingState`, etc.), allowing for more complex and varied behaviors.
*   **Improved Collision & Physics:**
    *   "Swept sphere" collision detection is now used for projectiles, preventing them from passing through targets at high speed.
    *   Collision hitboxes are now calculated correctly and do not "inflate" when objects rotate.
*   **Advanced Visual Effects:**
    *   Added a "wave" shield impact effect that ripples across the ship's hull from the point of impact.
    *   Asteroids now have unique, procedurally deformed meshes for better visual variety.
    *   Added floating damage numbers for better combat feedback.
*   **In-Game Console:** A developer console can be accessed via the backtick key (`\``) for debugging and running commands (`addcredits`, `spawn`, `killall`).

### :bug: **Bug Fixes**

*   Fixed numerous bugs related to collision detection, including "phantom" asteroids and incorrect hit registration.
*   Resolved issues with player respawning with incorrect stats.
*   Corrected flawed mathematical formulas in the collision detection algorithms.

### :wastebasket: **Removed Code**

*   The following legacy classes have been removed and their logic refactored into the ECS:
    *   `src/Ship.js`
    *   `src/Asteroid.js`
    *   `src/EnemyAI.js`
    *   `src/CollisionManager.js`
    *   `src/ProjectileManager.js`
    *   And many others...
