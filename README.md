# Drum-Machine
A web Drum Machine implemented using the Wep Audio API



## Overview
The machine offers an 8-step sequencer with 4 different drums (kick, snare, hi-hat and tom) where the user can create their custom beats, adjust different audio paramemeters and combine different patterns to create a song. To facilitate this process, functionalities like beat or step visualizers, save/load/reset a project and load custom samples and adjust their volume and pitch have been added.



## Project Structure
The project consists of an HTML file (`index.html`) and a CSS file (`style.css`), which handle the visualization and user interface of the drum machine.

All functionality is implemented exclusively in **JavaScript** using the **Web Audio API**, with the following files:

#### `sequencer.js`
Responsible for:
- Managing **BPM** and **Swing**.
- Maintaining the application's master timing clock.
- Scheduling sequencer steps, sound playback, and pattern progression.

#### `app.js`
Handles the application's core functionality, including:

- `Initial Setup`: Creates the **Audio Context** and initializes the application's main variables
- `Audio Effects Setup and Routing`: Creates and connects the audio processing nodes for the available effects, including **delay**, **reverb**, **distortion**, **compressor**, and a **three-band EQ (low, mid, high)**.
- `DOM References`: Connects the JavaScript code to the HTML interface elements, including buttons, sliders, and drag-and-drop areas.
- `Sequencer Initialization and Audio Loading`: Initializes the sequencer by connecting with `sequencer.js`, loads audio samples from the WAV files, and connects them to the Web Audio API audio graph.
- `Audio Management`: Provides the core audio functionality, including playing sounds, updating audio effects, and stopping all active audio.
- `Visualization`: Implements the **Spectrum Meter**, **Sequencer Grid**, and **Beat Visualizer**, updating them dynamically according to the current sequencer step and audio playback.
- `Playback and Sequencer Controls`: Connects the interface controls to the application logic, allowing users to start or stop playback, adjust **BPM** and **Swing**, edit patterns, and arrange multiple patterns into songs using **Song Mode**.
- `Project Management`: Allows projects to be saved as ZIP archives containing the project data (JSON) and the selected drum kit, loaded from previously exported ZIP files, or reset to the default settings and drum kit.
- `Auto Save`: Automatically saves the current project state so it is always ready for export.
- `Sample Loader and Editor`: Allows users to select a built-in drum kit, import a custom kit, and adjust the **volume** and **pitch** of each of the four drum sounds individually.
- `Initialization`: Performs the application's initial setup when the page is loaded.

### `sounds/` Directory
The `sounds` folder contains:
- The default drum kit.
- Four additional built-in kits:
  - Acoustic
  - Electronic
  - Vintage
  - Lo-Fi

## User instructions 
# Running the Project

The project requires a **local web server** to run correctly. Audio files are loaded using the JavaScript `fetch()` API, which is blocked for security reasons when opening files directly with the `file://` protocol. Therefore, a local server is required to successfully load the audio samples.

The project can be run using one of the following methods:

- **Visual Studio Code with the Live Server extension**: Open the project folder in **Visual Studio Code**, then right-click `index.html` (or anywhere in the project) and select **"Open with Live Server"**. This will launch the application in your default web browser.

- **Python HTTP Server**: Ensure that **Python 3** is installed and added to your system's `PATH`. Open a terminal or command prompt in the project's root directory and run:

  ```bash
  python -m http.server 8000
  ```

  On **macOS** or **Linux**, use:

  ```bash
  python3 -m http.server 8000
  ```

  Then, open your web browser and navigate to:

  ```text
  http://localhost:8000
  ```

During the development of the project, the application was tested using the **Python HTTP Server** (`python -m http.server 8000`) and the **Google Chrome** browser.