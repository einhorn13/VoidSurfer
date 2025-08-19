# Void Surfer v 0.2 (ELITE-inspired HTML5 game)

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
