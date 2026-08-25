# CourseFlow

A desktop homework tracker that solves the limitations of Canvas's to-do app.


## What is CourseFlow?

Canvas is one of the largest edTech platforms across North American universities. CourseFlow is a desktop app that acts as a homework tracker, solving many of the limitations in Canvas's to-do app.


## Core Features

### 1. Custom Priority Ordering
Assignments in Canvas are listed in chronological order only. CourseFlow allows users to re-order the list according to their own priorities — focus on what matters most to you, not just what's due next.

### 2. Superior UX & Ease of Use
Unlike Canvas, which crams the to-do list into a small sidebar component, CourseFlow offers a dedicated, smooth UI — a convenience layer built specifically for students. The process of marking assignments as "done" is simpler, faster, and more satisfying.

### 3. Sub-tasks & Note-Taking
Go beyond simple tracking. Break assignments into sub-tasks and add detailed notes about your progress. Use CourseFlow as a productivity app to log what you've been working on, not just what's due.


## Platform & Data

- **Cross-platform**: Built on Electron, CourseFlow runs on Windows, macOS, and Linux — no browser tab required.
- **100% local**: All data is stored locally in SQLite. Your data does NOT go to the cloud.
- **Sync**: Pull your latest assignments directly from the Canvas Calendar via iCal, keeping your list up to date.


## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Desktop Framework | **Electron** | Cross-platform desktop app (Windows, macOS, Linux) |
| Calendar Integration | **iCal** | Pulls data directly from the Canvas Calendar |
| Backend | **TypeScript** | Best support for working with iCal |
| Frontend | **React** | Modern, responsive desktop UI |
| Database | **SQLite** | Local data storage |


## Architecture

The app is split across two processes, bridged by secure IPC:

```mermaid
flowchart TB
    subgraph Main["Electron Main (Node process)"]
        M1["App lifecycle & window management"]
        M2["iCal fetch/parse (Node + TypeScript)"]
        M3["SQLite access"]
    end

    IPC[/"IPC — contextIsolation, preload bridge"/]

    subgraph Renderer["React Renderer"]
        R1["UI / components"]
        R2["State management"]
        R3["Drag-and-drop, filters, notes"]
    end

    M1 ~~~ M2 ~~~ M3
    Main <-->|secure IPC| IPC
    IPC <--> Renderer
```

- **Electron Main** handles the Node-side heavy lifting: app lifecycle, window management, fetching/parsing the Canvas iCal feed, and all SQLite access.
- **React Renderer** is the UI layer — components, state, and interactions — kept sandboxed behind `contextIsolation`.
- **IPC** is the only channel between the two processes, exposed through a thin preload bridge.


## Roadmap

### v0.1 — MVP
- Parse the Canvas iCal calendar feed
- Display assignments in a chronological list
- Mark assignments as done

### v0.2 — Priority & Organization
- Re-order assignments by personal priority (drag-and-drop)
- Filter and sort views

### v0.3 — Productivity Depth
- Break assignments into sub-tasks
- Add notes and log your progress

### v1.0 — Launch
- Polished, dedicated desktop UI
- Cross-platform packaging for Windows, macOS, and Linux
- Reliable iCal syncing and refresh

### Later
- Due-date reminders and notifications
- Optional cloud backup *


*<small>Backup details and pricing are still being decided.</small>


## Getting Started

*Coming soon — installation and setup instructions.*


## License

*To be determined.*